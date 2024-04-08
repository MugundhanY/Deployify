import B2 from 'backblaze-b2';
import fs from 'fs';        
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const applicationKeyId = process.env.APPLICATION_KEY_ID!;
const applicationKey = process.env.APPLICATION_KEY!;
const bucketId = process.env.BUCKET_ID!;
const bucketName = process.env.BUCKET_NAME!;

const s3 = new B2({
    applicationKeyId: applicationKeyId,
    applicationKey: applicationKey,
});

async function listAllFiles(prefix: string): Promise<string[]> {
    const allFiles: string[] = [];

    async function listFiles(folderPrefix: string, nextFileName: string | undefined) {
        const response = await s3.listFileNames({
            bucketId: bucketId,
            startFileName: nextFileName || '',
            maxFileCount: 1000,
            prefix: folderPrefix,
            delimiter: '/',
        });

        if (!response.data) {
            console.error('Error: Unexpected response format.');
            return;
        }

        const files = response.data.files?.map((file: { fileName: string }) => file.fileName) || [];
        const filteredFiles = files.filter((file: string) => !file.endsWith('/'));
        const filteredFolders = files.filter((file: string) => file.endsWith('/'));

        allFiles.push(...filteredFiles);

        for (const folder of filteredFolders) {
            await listFiles(folder, nextFileName);
        }
    }

    await listFiles(prefix, undefined);

    return allFiles;
}

export async function downloadS3Folder(prefix: string) {
    await s3.authorize();

    try {
        const allFiles = await listAllFiles(prefix);
        console.log('Files in the folder:', allFiles);

        const allPromises = allFiles.map(async (Key) => {
            return new Promise(async (resolve) => {
                if (!Key) {
                    resolve("");
                    return;
                }
                const finalOutputPath = path.join(__dirname, Key);
                const outputFile = fs.createWriteStream(finalOutputPath);
                const dirName = path.dirname(finalOutputPath);
                if (!fs.existsSync(dirName)){
                    fs.mkdirSync(dirName, { recursive: true });
                }
                const downloadOpts: any = {
                    bucketName,
                    fileName: Key,
                    responseType: 'arraybuffer',
                };

                const { data } = await s3.downloadFileByName(downloadOpts);

                await fs.promises.writeFile(finalOutputPath, data);

                resolve("");


            });
        }) || []
        console.log("awaiting");
    
        await Promise.all(allPromises?.filter(x => x !== undefined));
    } catch (error: any) {
        console.error('Error:', error.response ? error.response.data : error.message);
    }
}

export function getAllFiles(folderPath: string) {
    let response: string[] = [];

    const allFilesAndFolders = fs.readdirSync(folderPath);
    allFilesAndFolders.forEach(file => {
        const fullFilePath = path.join(folderPath, file);
        if(fs.statSync(fullFilePath).isDirectory()){
            response = response.concat(getAllFiles(fullFilePath))
        } else {
            response.push(fullFilePath);
        }
    });
    return response;
}

export const uploadFile = async (fileName: string, localFilePath: string) => {
    await s3.authorize();

    const uploadUrl = await s3.getUploadUrl({ bucketId: bucketId }); 
    const fileContent = fs.readFileSync(localFilePath);

    const response = await s3.uploadFile({
        uploadUrl: uploadUrl.data.uploadUrl,
        uploadAuthToken: uploadUrl.data.authorizationToken,
        fileName: fileName,
        data: fileContent,
    });

    console.log(response);
};

export function copyFinalDist(id: string) {
    const folderPath = path.join(__dirname, `output/${id}/dist`);
    const allFiles = getAllFiles(folderPath);
    allFiles.forEach(file => {
        const relativePath = `dist/${id}/` + file.slice(folderPath.length + 1).replace(/\\/g, '/').replace(/^\//, '');
        uploadFile(relativePath, file);
    })
    console.log(allFiles);
}