import B2 from 'backblaze-b2';
import fs from "fs";
import dotenv from 'dotenv';
dotenv.config();

// Ensure that process.env.APPLICATION_KEY_ID is defined
const applicationKeyId = process.env.APPLICATION_KEY_ID!;
const applicationKey = process.env.APPLICATION_KEY!;
const bucketId = process.env.BUCKET_ID!;

const s3 = new B2({
    applicationKeyId: applicationKeyId,
    applicationKey: applicationKey,
});

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
