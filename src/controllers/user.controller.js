import { ApiErrors } from "../utils/ApiErrors.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import {uploadCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";

const generateAccessAndRefereshTokens = async(userId) =>{
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return {accessToken, refreshToken}


    } catch (error) {
          console.log("ACTUAL TOKEN ERROR:", error);
        throw new ApiErrors(500, "Something went wrong while generating referesh and access token")
    }
}

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

const loginUser = asyncHandler(async (req, res) =>{
    // req body -> data
    // username or email
    //find the user
    //password check
    //access and referesh token
    //send cookie

    const {email, username, password} = req.body
    console.log(email);

    if (!username && !email) {
        throw new ApiErrors(400, "username or email is required")
    }
    
    // Here is an alternative of above code based on logic discussed in video:
    // if (!(username || email)) {
    //     throw new ApiError(400, "username or email is required")
        
    // }

    const user = await User.findOne({
        $or: [{username}, {email}]
    })

    if (!user) {
        throw new ApiErrors(404, "User does not exist")
    }

   const isPasswordValid = await user.isPasswordCorrect(password)

   if (!isPasswordValid) {
    throw new ApiErrors(401, "Invalid user credentials")
    }

   const {accessToken, refreshToken} = await generateAccessAndRefereshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200, 
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged In Successfully"
        )
    )

})

const logoutUser = asyncHandler(async(req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1 // this removes the field from document
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"))
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken) {
        throw new ApiErrors(401, "unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        const user = await User.findById(decodedToken?._id)
    
        if (!user) {
            throw new ApiErrors(401, "Invalid refresh token")
        }
    
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiErrors(401, "Refresh token is expired or used")
            
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const {accessToken, newRefreshToken} = await generateAccessAndRefereshTokens(user._id)
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200, 
                {accessToken, refreshToken: newRefreshToken},
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new ApiErrors(401, error?.message || "Invalid refresh token")
    }

})

export { registerUser,
     loginUser, 
     generateAccessAndRefereshTokens,
     logoutUser, 
    refreshAccessToken }
