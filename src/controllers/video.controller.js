import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiErrors as ApiError } from "../utils/ApiErrors.js";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { Comment } from "../models/comment.model.js";
import {
    uploadCloudinary,
    deleteOnCloudinary
} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import mongoose, { isValidObjectId } from "mongoose";
import { Like } from "../models/like.model.js";
import { pipeline } from "@huggingface/transformers";
import ffmpegPath from "ffmpeg-static";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import wavefile from "wavefile";

// get all videos based on query, sort, pagination
const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;
    console.log(userId);
    const pipeline = [];

    // for using Full Text based search u need to create a search index in mongoDB atlas
    // you can include field mapppings in search index eg.title, description, as well
    // Field mappings specify which fields within your documents should be indexed for text search.
    // this helps in seraching only in title, desc providing faster search results
    // here the name of search index is 'search-videos'
    if (query) {
        pipeline.push({
            $search: {
                index: "search-videos",
                text: {
                    query: query,
                    path: ["title", "description"] //search only on title, desc
                }
            }
        });
    }

    if (userId) {
        if (!isValidObjectId(userId)) {
            throw new ApiError(400, "Invalid userId");
        }

        pipeline.push({
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
            }
        });
    }

    // fetch videos only that are set isPublished as true
    pipeline.push({ $match: { isPublished: true } });

    //sortBy can be views, createdAt, duration
    //sortType can be ascending(-1) or descending(1)
    if (sortBy && sortType) {
        pipeline.push({
            $sort: {
                [sortBy]: sortType === "asc" ? 1 : -1
            }
        });
    } else {
        pipeline.push({ $sort: { createdAt: -1 } });
    }

    pipeline.push(
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "ownerDetails",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            "avatar.url": 1
                        }
                    }
                ]
            }
        },
        {
            $unwind: "$ownerDetails"
        }
    )

    const videoAggregate = Video.aggregate(pipeline);

    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
    };

    const video = await Video.aggregatePaginate(videoAggregate, options);

    return res
        .status(200)
        .json(new ApiResponse(200, video, "Videos fetched successfully"));
});

// get video, upload to cloudinary, create video
const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body;

    if ([title, description].some((field) => field?.trim() === "")) {
        throw new ApiError(400, "All fields are required");
    }

    const videoFileLocalPath = req.files?.videoFile[0].path;
    const thumbnailLocalPath = req.files?.thumbnail[0].path;

    if (!videoFileLocalPath) {
        throw new ApiError(400, "videoFileLocalPath is required");
    }

    if (!thumbnailLocalPath) {
        throw new ApiError(400, "thumbnailLocalPath is required");
    }

    const videoFile = await uploadCloudinary(videoFileLocalPath);
    const thumbnail = await uploadCloudinary(thumbnailLocalPath);

    if (!videoFile) {
        throw new ApiError(400, "Video file not found");
    }

    if (!thumbnail) {
        throw new ApiError(400, "Thumbnail not found");
    }

    const video = await Video.create({
        title,
        description,
        duration: videoFile.duration,
        videoFile: {
            url: videoFile.url,
            public_id: videoFile.public_id
        },
        thumbnail: {
            url: thumbnail.url,
            public_id: thumbnail.public_id
        },
        owner: req.user?._id,
        isPublished: false
    });

    const videoUploaded = await Video.findById(video._id);

    if (!videoUploaded) {
        throw new ApiError(500, "videoUpload failed please try again !!!");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, video, "Video uploaded successfully"));
});

// get video by id
const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    // let userId = req.body;

    // userId = new mongoose.Types.ObjectId(userId)
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId");
    }

    if (!isValidObjectId(req.user?._id)) {
        throw new ApiError(400, "Invalid userId");
    }

    const video = await Video.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(videoId)
            }
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "likes"
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    {
                        $lookup: {
                            from: "subscriptions",
                            localField: "_id",
                            foreignField: "channel",
                            as: "subscribers"
                        }
                    },
                    {
                        $addFields: {
                            subscribersCount: {
                                $size: "$subscribers"
                            },
                            isSubscribed: {
                                $cond: {
                                    if: {
                                        $in: [
                                            req.user?._id,
                                            "$subscribers.subscriber"
                                        ]
                                    },
                                    then: true,
                                    else: false
                                }
                            }
                        }
                    },
                    {
                        $project: {
                            username: 1,
                            "avatar.url": 1,
                            subscribersCount: 1,
                            isSubscribed: 1
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                likesCount: {
                    $size: "$likes"
                },
                owner: {
                    $first: "$owner"
                },
                isLiked: {
                    $cond: {
                        if: { $in: [req.user?._id, "$likes.likedBy"] },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                "videoFile.url": 1,
                title: 1,
                description: 1,
                views: 1,
                createdAt: 1,
                duration: 1,
                comments: 1,
                owner: 1,
                likesCount: 1,
                isLiked: 1
            }
        }
    ]);

    if (!video) {
        throw new ApiError(500, "failed to fetch video");
    }

    // increment views if video fetched successfully
    await Video.findByIdAndUpdate(videoId, {
        $inc: {
            views: 1
        }
    });

    // add this video to user watch history
    await User.findByIdAndUpdate(req.user?._id, {
        $addToSet: {
            watchHistory: videoId
        }
    });

    return res
        .status(200)
        .json(
            new ApiResponse(200, video[0], "video details fetched successfully")
        );
});

// update video details like title, description, thumbnail
const updateVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body;
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId");
    }

    if (!(title && description)) {
        throw new ApiError(400, "title and description are required");
    }

    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "No video found");
    }

    if (video?.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(
            400,
            "You can't edit this video as you are not the owner"
        );
    }

    //deleting old thumbnail and updating with new one
    const thumbnailToDelete = video.thumbnail.public_id;

    const thumbnailLocalPath = req.file?.path;

    if (!thumbnailLocalPath) {
        throw new ApiError(400, "thumbnail is required");
    }

    const thumbnail = await uploadCloudinary(thumbnailLocalPath);

    if (!thumbnail) {
        throw new ApiError(400, "thumbnail not found");
    }

    const updatedVideo = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {
                title,
                description,
                thumbnail: {
                    public_id: thumbnail.public_id,
                    url: thumbnail.url
                }
            }
        },
        { new: true }
    );

    if (!updatedVideo) {
        throw new ApiError(500, "Failed to update video please try again");
    }

    if (updatedVideo) {
        await deleteOnCloudinary(thumbnailToDelete);
    }

    return res
        .status(200)
        .json(new ApiResponse(200, updatedVideo, "Video updated successfully"));
});

// delete video
const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId");
    }

    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "No video found");
    }

    if (video?.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(
            400,
            "You can't delete this video as you are not the owner"
        );
    }

    const videoDeleted = await Video.findByIdAndDelete(video?._id);

    if (!videoDeleted) {
        throw new ApiError(400, "Failed to delete the video please try again");
    }

    await deleteOnCloudinary(video.thumbnail.public_id); // video model has thumbnail public_id stored in it->check videoModel
    await deleteOnCloudinary(video.videoFile.public_id, "video"); // specify video while deleting video

    // delete video likes
    await Like.deleteMany({
        video: videoId
    })

    // delete video comments
    await Comment.deleteMany({
        video: videoId,
    })

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Video deleted successfully"));
});

// toggle publish status of a video
const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId");
    }

    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    if (video?.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(
            400,
            "You can't toogle publish status as you are not the owner"
        );
    }

    const toggledVideoPublish = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {
                isPublished: !video?.isPublished
            }
        },
        { new: true }
    );

    if (!toggledVideoPublish) {
        throw new ApiError(500, "Failed to toogle video publish status");
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { isPublished: toggledVideoPublish.isPublished },
                "Video publish toggled successfully"
            )
        );
});

const execFileAsync = promisify(execFile);

let transcriber = null;

const getTranscriber = async () => {
    if (!transcriber) {
        console.log("Loading Whisper model...");

        transcriber = await pipeline(
            "automatic-speech-recognition",
            "Xenova/whisper-tiny"
        );

        console.log("Whisper model loaded");
    }

    return transcriber;
};

// Ask anything about a video
const askQuestionAboutVideo = asyncHandler(async (req, res) => {

    const { videoId } = req.params;
    const { question } = req.body;

    // =====================================================
    // 1. Validate videoId
    // =====================================================

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId");
    }

    // =====================================================
    // 2. Validate question
    // =====================================================

    if (!question || question.trim() === "") {
        throw new ApiError(400, "Question is required");
    }

    // =====================================================
    // 3. Find video
    // =====================================================

    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    if (!video.videoFile?.url) {
        throw new ApiError(400, "Video URL not found");
    }

    // =====================================================
    // 4. Check OpenRouter API key
    // =====================================================

    const OPENROUTER_API_KEY =
        process.env.OPENROUTER_API_KEY;

    if (!OPENROUTER_API_KEY) {
        throw new ApiError(
            500,
            "OpenRouter API key is not configured"
        );
    }

    // =====================================================
    // 5. Get existing transcript
    // =====================================================

    let transcript = video.transcript;

    // =====================================================
    // 6. Generate transcript if it doesn't exist
    // =====================================================

    if (!transcript || transcript.trim() === "") {

        console.log(
            `Generating transcript for video: ${videoId}`
        );

        // -------------------------------------------------
        // Create temporary directory
        // -------------------------------------------------

        const tempDir = await fs.mkdtemp(
            path.join(os.tmpdir(), "pixelstream-")
        );

        const videoPath = path.join(
            tempDir,
            "video.mp4"
        );

        const audioPath = path.join(
            tempDir,
            "audio.wav"
        );

        try {

            // =================================================
            // 6A. Download video from Cloudinary
            // =================================================

            console.log("Downloading video...");

            const videoResponse = await fetch(
                video.videoFile.url
            );

            if (!videoResponse.ok) {

                throw new ApiError(
                    502,
                    "Failed to download video from Cloudinary"
                );
            }

            const videoBuffer =
                Buffer.from(
                    await videoResponse.arrayBuffer()
                );

            await fs.writeFile(
                videoPath,
                videoBuffer
            );

            console.log(
                "Video downloaded successfully"
            );

            // =================================================
            // 6B. Extract audio using FFmpeg
            // =================================================

            console.log(
                "Extracting audio from video..."
            );

            await execFileAsync(
                ffmpegPath,
                [
                    "-i",
                    videoPath,

                    // mono audio
                    "-ac",
                    "1",

                    // Whisper expects 16kHz audio
                    "-ar",
                    "16000",

                    // WAV PCM format
                    "-c:a",
                    "pcm_s16le",

                    // overwrite if exists
                    "-y",

                    audioPath
                ]
            );

            console.log(
                "Audio extracted successfully"
            );

            // =================================================
            // 6C. Load Whisper model
            // =================================================

            const whisper = await getTranscriber();


            // =================================================
            // 6D. Load WAV audio
            // =================================================

            console.log(
                "Loading audio for Whisper..."
            );

            const audioBuffer = await fs.readFile(audioPath);

            const wav = new wavefile.WaveFile(audioBuffer);

            // Convert WAV to Float32
            wav.toBitDepth("32f");

            // Whisper expects 16kHz audio
            wav.toSampleRate(16000);

            let audio = wav.getSamples();

            // If audio has multiple channels,
            // use the first channel
            if (Array.isArray(audio)) {
                audio = audio[0];
            }

            console.log(
                "Audio loaded successfully"
            );


            // =================================================
            // 6E. Generate transcript
            // =================================================

            console.log(
                "Generating transcript with Whisper..."
            );

            const transcription =
                await whisper(
                    audio,
                    {
                        chunk_length_s: 30,
                        stride_length_s: 5
                    }
                );

            transcript =
                transcription?.text?.trim();

            if (!transcript) {

                throw new ApiError(
                    502,
                    "Whisper returned an empty transcript"
                );
            }

            console.log(
                "Transcript generated successfully"
            );

            // =================================================
            // 6F. Save transcript to MongoDB
            // =================================================

            video.transcript = transcript;

            await video.save();

            console.log(
                "Transcript saved to database"
            );

        } finally {

            // =================================================
            // 6G. Delete temporary files
            // =================================================

            try {

                await fs.rm(
                    tempDir,
                    {
                        recursive: true,
                        force: true
                    }
                );

            } catch (cleanupError) {

                console.error(
                    "Temporary file cleanup failed:",
                    cleanupError
                );
            }
        }
    }

    // =====================================================
    // 7. Ask OpenRouter using transcript
    // =====================================================

    console.log(
        "Sending transcript + question to OpenRouter..."
    );

    const answerResponse = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
            method: "POST",

            headers: {
                "Authorization":
                    `Bearer ${OPENROUTER_API_KEY}`,

                "Content-Type":
                    "application/json",

                "HTTP-Referer":
                    process.env.FRONTEND_URL ||
                    "http://localhost:5173",

                "X-Title":
                    "PixelStream"
            },

            body: JSON.stringify({

                // =========================================
                // FREE TEXT MODEL ROUTER
                // =========================================

                model: "openrouter/free",

                messages: [

                    // =====================================
                    // SYSTEM
                    // =====================================

                    {
                        role: "system",

                        content: `
You are PixelStream's "Ask Anything" assistant.

Your job is to answer questions about a video using
ONLY the transcript provided by PixelStream.

Rules:

1. Use only information present in the transcript.

2. Do not use outside knowledge.

3. Do not invent or assume information.

4. If the answer cannot be found in the transcript,
   say exactly:

"I couldn't find that information in this video."

5. Keep answers clear and conversational.

6. If the user asks for a summary, summarize only
   the relevant information from the transcript.

7. If the transcript contains multiple languages,
   understand the content and answer the user in
   the same language as the user's question whenever
   reasonably possible.
`
                    },

                    // =====================================
                    // USER
                    // =====================================

                    {
                        role: "user",

                        content: `
VIDEO TRANSCRIPT:

${transcript}

================================

USER QUESTION:

${question}
`
                    }
                ],

                temperature: 0.2,

                max_tokens: 2000
            })
        }
    );

    // =====================================================
    // 8. Parse OpenRouter response
    // =====================================================

    const answerData =
        await answerResponse.json();

    // =====================================================
    // 9. Handle OpenRouter errors
    // =====================================================

    if (!answerResponse.ok) {

        console.error(
            "OpenRouter answer error:",
            answerData
        );

        throw new ApiError(
            502,
            "Failed to generate answer"
        );
    }

    // =====================================================
    // 10. Extract answer
    // =====================================================

    const answer =
        answerData?.choices?.[0]?.message?.content;

    if (!answer) {

        throw new ApiError(
            502,
            "AI returned an empty answer"
        );
    }

    // =====================================================
    // 11. Return response
    // =====================================================

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {
                    videoId,
                    question,
                    answer,

                    // true = transcript already existed
                    // false = transcript was generated now
                    transcriptGenerated:
                        !!video.transcript
                },

                "Answer generated successfully"
            )
        );
});

export {
    publishAVideo,
    updateVideo,
    deleteVideo,
    getAllVideos,
    getVideoById,
    togglePublishStatus,
    askQuestionAboutVideo,
};