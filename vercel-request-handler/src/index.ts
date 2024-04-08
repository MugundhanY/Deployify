import express from "express";
import B2 from 'backblaze-b2';
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

const app = express();

app.get("/*", async (req, res) => {
  const host = req.hostname;
  const id = host.split(".")[0];
  const filePath = req.path;
  await s3.authorize();
  
  try {
    let downloadOpts: any;
    let contentType = '';

    if (filePath.endsWith(".html") || filePath.endsWith(".css") || filePath.endsWith(".js")) {
        downloadOpts = {
            bucketName,
            fileName: `dist/${id}${filePath}`,
        };
        contentType = filePath.endsWith(".html") ? "text/html" : 
                      filePath.endsWith(".css") ? "text/css" : 
                      "application/javascript";
    } else {
        downloadOpts = {
            bucketName,
            fileName: `output/${id}${filePath}`,
        };
        contentType = filePath.endsWith(".png") ? "image/png" : 
                      filePath.endsWith(".jpg") || filePath.endsWith(".jpeg") ? "image/jpeg" : 
                      filePath.endsWith(".ico") ? "image/x-icon" :
                      "application/octet-stream";
    }

    console.log("Fetching file:", downloadOpts.fileName);
    const { data } = await s3.downloadFileByName(downloadOpts);

    // Calculate Content-Length
    const contentLength = data.length;


    res.set("Content-Type", contentType);
    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.set("Content-Length", contentLength.toString()); // Convert to string
    res.send(data);
  } catch (error) {
    console.error("Error downloading file from Backblaze B2:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.listen(3001, () => {
  console.log('Server is running on port 3001');
});
