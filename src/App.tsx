import './App.css'
import * as XLSX from 'xlsx';
import {ChangeEvent, useState} from "react";
import {saveAs} from "file-saver"

type Row = {
    EAN: number;
    NAZWA: string;
    CENA: number;
    DYS: string;
}

type Product = {
    ean: number;
    rows: Row[];
}

type ExportRow = {
    EAN: string;
    NAZWA: string;
    CENA: number;
    DYS: string;
    ROZNICA: string;
}

enum Difference {
    PERCENT,
    PLN
}

function App() {
    const [fileData, setFileData] = useState<Row[]>([]);
    const [diffType, setDiffType] = useState<Difference>(Difference.PERCENT);
    const [diff, setDiff] = useState(15);

    const handleFilesUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const fileList = event.target.files;
        // @ts-ignore
        const files = Array.from(fileList);
        await handleFilesRead(files)
    };

    const handleFilesRead = async (files: File[]) => {
        const allData: Row[] = [];

        const readFile = (file: File): Promise<any[]> => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    if (!e.target?.result) return reject("Failed to read file");

                    const data = new Uint8Array(e.target.result as ArrayBuffer);
                    const workbook = XLSX.read(data, {type: "array"});

                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];

                    const jsonData = XLSX.utils.sheet_to_json(sheet);
                    resolve(jsonData);
                };

                reader.onerror = () => reject("Error reading file");
                reader.readAsArrayBuffer(file);
            });
        };

        try {
            // Read all files and store data
            const filePromises = Array.from(files).map(readFile);
            const results = await Promise.all(filePromises);

            // Flatten array of arrays
            results.forEach((data) => allData.push(...data));
            setFileData(allData)
        } catch (error) {
            console.error("Error processing files:", error);
        }
    };

    const groupProducts = (products: Row[]) => {
        const groupedProducts: Product[] = []
        products.forEach(product => {
            const foundProduct = groupedProducts.find(p => p.ean === product.EAN)
            if (foundProduct) foundProduct.rows.push(product)
            else groupedProducts.push({ean: product.EAN, rows: [product]})
        })
        return groupedProducts;
    }

    const analyzeProducts = () => {
        if (fileData.length <= 0) {
            return;
        }
        const groupedProducts = groupProducts(fileData);
        const rowsToExport: ExportRow[] = []
        groupedProducts.forEach(product => {
            if (diffType === Difference.PERCENT) {
                const rows = findDifferentProductsPercent(product);
                rowsToExport.push(...rows);
            } else {
                const rows = findDifferentProductsPLN(product);
                rowsToExport.push(...rows);
            }
        })
        exportToExcel(rowsToExport);
    }

    const findDifferentProductsPercent = (product: Product) => {
        const rowsToExport: ExportRow[] = []
        product.rows.sort((a, b) => a.CENA - b.CENA);
        const biggestPrice = product.rows[product.rows.length - 1].CENA
        const threshold = (1 - diff) * biggestPrice;
        product.rows.map(p => {
            if(p.CENA <= threshold) {
                rowsToExport.push({
                    EAN: p.EAN.toString(),
                    CENA: p.CENA,
                    NAZWA: p.NAZWA,
                    DYS: p.DYS,
                    ROZNICA: (Math.round((biggestPrice - p.CENA) * 100) / 100).toString() + " zł"
                })
            }
        })
        return rowsToExport
    }

    const findDifferentProductsPLN = (product: Product) => {
        const rowsToExport: ExportRow[] = []
        product.rows.sort((a, b) => a.CENA - b.CENA);
        const biggestPrice = product.rows[product.rows.length - 1].CENA
        const threshold = biggestPrice - diff;
        product.rows.map(p => {
            if(p.CENA <= threshold) {
                rowsToExport.push({
                    EAN: p.EAN.toString(),
                    CENA: p.CENA,
                    NAZWA: p.NAZWA,
                    DYS: p.DYS,
                    ROZNICA: (Math.round((biggestPrice - p.CENA) * 100) / 100).toString() + " zł"
                })
            }
        })
        return rowsToExport
    }

    const exportToExcel = (data: ExportRow[]) => {
        // Convert JSON data to a worksheet
        const worksheet = XLSX.utils.json_to_sheet(data);

        // Create a new workbook and append the worksheet
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Arkusz1");

        // Write the workbook and convert it to a Blob
        const excelBuffer = XLSX.write(workbook, {bookType: "xlsx", type: "array"});
        const dataBlob = new Blob([excelBuffer], {type: "application/octet-stream"});

        // Save the file
        saveAs(dataBlob, "example.xlsx");
    };

    return (
        <>
            <h1>Wprowadź pliki excel (.xlsx, .xls)</h1>
            <div className={"form-container"}>
                <div className={"form-column"}>
                    <div className={"input-container"}>
                        <input type="file" accept={".xlsx, .xls"} onChange={handleFilesUpload} multiple/>
                    </div>
                    <div className={"input-container"}>
                        <select
                            value={diffType}
                            onChange={(e) => setDiffType(e.target.value as unknown as Difference)}
                        >
                            <option value={Difference.PERCENT}>Różnica w procentach</option>
                            <option value={Difference.PLN}>Różnica w złotówkach</option>
                        </select>
                    </div>
                    <div className={"input-container"}>
                        <span>Różnica: </span><input type={"number"} onChange={e => setDiff(Number(e.target.value))}
                                        defaultValue={15} name={"diff"}/>
                    </div>
                </div>
            </div>

            <button onClick={() => analyzeProducts()}>Przeanalizuj</button>
        </>
    )
}

export default App
