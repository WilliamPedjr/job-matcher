const express = require("express");
const multer = require("multer");
const fs = require("fs");

const pdfParse = require("pdf-parse");

const { processResume } = require("../services/resumeProcessor");
const { getEmbedding } = require("../services/embeddingService");
const { cosineSimilarity } = require("../services/similarityService");

const router = express.Router();

const jobs = require("../jobs.json");

const upload = multer({
    dest: "uploads/"
});

/*
=====================================
 ATS WEIGHTS
=====================================
*/
const WEIGHTS = {
    skill: 0.55,
    experience: 0.20,
    project: 0.20,
    embedding: 0.05
};

/*
=====================================
 MATCH ROUTE
=====================================
*/

router.post("/match", upload.single("cv"), async (req,res)=>{

    try{

        if(!req.file){
            return res.status(400).json({
                error:"CV file required"
            });
        }

        /*
        =====================================
        Extract Resume Text (PDF + OCR)
        =====================================
        */

        const resumeText = await processResume(req.file.path);

        const resumeEmbedding = await getEmbedding(resumeText);

        /*
        =====================================
        Match Against Job Listings
        =====================================
        */

        let results = [];

        for(const job of jobs){

            const jobText = job.description
                .replace(/\s+/g," ")
                .slice(0,4000);

            const jobEmbedding = await getEmbedding(jobText);

            /*
            =====================================
            Semantic Matching
            =====================================
            */

            const embeddingScore =
                cosineSimilarity(resumeEmbedding, jobEmbedding) || 0;

            /*
            =====================================
            ATS Rule Scoring (Simple Logic)
            =====================================
            */

            const resumeLower = resumeText.toLowerCase();
            const jobLower = jobText.toLowerCase();

            const skillMatches = job.skills ?
                job.skills.filter(skill =>
                    resumeLower.includes(skill)
                ).length / (job.skills.length || 1)
                : 0;

            const finalScore =
                (skillMatches * WEIGHTS.skill) +
                (embeddingScore * WEIGHTS.embedding);

            /*
            =====================================
            Classification Threshold
            =====================================
            */

            let qualification;

            if(finalScore >= 0.8){
                qualification = "Highly Qualified";
            }
            else if(finalScore >= 0.6){
                qualification = "Moderately Qualified";
            }
            else{
                qualification = "Not Qualified";
            }

            results.push({
                jobTitle: job.title,
                score: (finalScore * 100).toFixed(2),
                qualification
            });

        }

        /*
        =====================================
        Sort Results
        =====================================
        */

        results.sort((a,b)=> b.score - a.score);

        res.json({
            success:true,
            matches: results
        });

    }
    catch(err){
        console.error(err);

        res.status(500).json({
            success:false,
            error: err.message
        });
    }

});

module.exports = router;