import express, { Router } from "express";
const router: Router = express.Router();

import { signUp, sendOtp, verifyOtp, forgotPassword, changePassword } from "../controllers/authController";
import { signupValidator, phoneNumberValidator, otpValidator, changePasswordValidator } from "../utils/validations";
import { authenticateUser } from "../middlewares/authenticateUser";

router.post("/signup", signupValidator, signUp);
router.post("/send-otp", phoneNumberValidator, sendOtp);
router.post("/verify-otp", [...phoneNumberValidator, ...otpValidator], verifyOtp);
router.post("/forgot-password", phoneNumberValidator, forgotPassword);
router.post("/change-password", authenticateUser, changePasswordValidator, changePassword);

export default router;
