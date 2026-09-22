import { ApiErrors } from "../utils/ApiErrors.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import {uploadCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler( async (req, res) => {

    // Get data 
    const { fullname, email, username, password } = req.body;
    console.log(fullname);
    console.log(email);
    console.log(username);
    console.log(password);

    // Check all required fields are filled or not
    if (
        [fullname, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiErrors(400, "All fields are required")
    }

    console.log("reached : All text data fields are correctly fed");

    //Validate the data email, username etc
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

    // 1. Check if email exists, 2. Check length constraint, 3. Test against regex
    if (!email || email.length > 254 || !emailRegex.test(email)) {
        throw new ApiErrors(400, "Invalid email format. Please provide a valid email address.");
    } else {
        console.log("Email is valid! Proceeding...");
    }

    console.log("reached : Email validation done");

    //Check is user already exists
    const existedUser = await User.findOne({
        $or : [{username}, {email}]
    })

    if(existedUser){
        throw new ApiErrors(409, "Username / Email already exists !");
    }

    console.log("reached : Check is user already exists done");

    // Handling uploaded media
    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;

     let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }

     console.log("reached : got files upload local path");

    if(!avatarLocalPath){
         throw new ApiErrors(400, "Avatar file is required! ");
    }

    // Upload image on cloudinary
    const avatar =await uploadCloudinary(avatarLocalPath);
    let coverImage = "";
    if(coverImageLocalPath){
        coverImage =await uploadCloudinary(coverImageLocalPath);
    }

     console.log("reached : got files upload to cloudinary");

    if(! avatar){
        throw new ApiErrors(400, "Avatar file is required! ");
    }
   console.log("reached : got cloudinary paths for images");
    // Store all data in DB
    const user = await User.create({
        fullname,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    });

     console.log("reached : successfully stored in DB");
    const CreatedUser = await User.findOne(user._id).select(
        "-password -refreshToken"
    );
    if(!CreatedUser){
        throw new ApiErrors(500, "User not created , Server error");
    }

    return res.status(201).json(
        new ApiResponse(200, CreatedUser, "User registered successfully!")
    );
    console.log("reached : End ");
    
})

export { registerUser }
