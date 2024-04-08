import express from "express";
import cors from "cors";
import simpleGit from "simple-git";
import { generate } from "./utils";
import path from "path";
import { getAllFiles } from "./files";
import { uploadFile } from "./aws";
import { createClient } from "redis";
const publisher = createClient();
publisher.connect();

const subscriber = createClient();
subscriber.connect();

const app = express();
app.use(cors());
app.use(express.json());

app.post("/deploy", async (req, res) => {
    const repoUrl = req.body.repoUrl;
    const id = generate();
    console.log(id);
    const outputDir = path.join(__dirname, `output/${id}`);
    
    await simpleGit().clone(repoUrl, outputDir);
    
    const files = getAllFiles(outputDir);
    const uploadPromises = files.map(async (file) => {
        const relativePath = file.slice(__dirname.length + 1).replace(/\\/g, '/').replace(/^\//, '');
        await uploadFile(relativePath, file);
        return relativePath;
    });

    try {
        const uploadedFiles = await Promise.all(uploadPromises);
        await publisher.lPush("build-queue", id);
        await publisher.hSet("status", id, "uploaded");
        res.json({ id });
    } catch (error) {
        console.error("Error uploading files:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.get("/status", async (req,res) => {
    const id = req.query.id;
    const response = await subscriber.hGet("status", id as string);
    res.json({
        status: response
    })
})

app.listen(3000);
