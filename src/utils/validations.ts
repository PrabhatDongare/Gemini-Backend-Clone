import { body } from "express-validator";

export const phoneNumberValidator = [
    body("phoneNumber")
        .trim()
        .notEmpty()
        .withMessage("phoneNumber is required")
        .matches(/^\+?[1-9]\d{7,14}$/)
        .withMessage("phoneNumber must be a valid international number"),
];

export const signupValidator = [
    ...phoneNumberValidator,
    body("password")
        .isString()
        .isLength({ min: 8, max: 30 })
        .withMessage("password must be 8-30 characters")
        .matches(/^(?=.*[A-Za-z])(?=.*\d).+$/)
        .withMessage("password must contain letters and numbers"),
    body("email")
        .optional({ nullable: true })
        .isEmail()
        .withMessage("Invalid email format")
        .normalizeEmail(),
    body("fullName")
        .optional({ nullable: true })
        .isLength({ min: 3, max: 30 })
        .withMessage("fullName must be between 3 and 30 characters")
        .trim(),
];

export const otpValidator = [
    body("otp")
        .trim()
        .notEmpty()
        .isLength({ min: 6, max: 6 })
        .withMessage("otp must be a 6-digit code")
        .isNumeric()
        .withMessage("otp must contain only digits"),
];

export const changePasswordValidator = [
    body("currentPassword")
        .isString()
        .isLength({ min: 8, max: 30 })
        .withMessage("currentPassword must be 8-30 characters")
        .matches(/^(?=.*[A-Za-z])(?=.*\d).+$/)
        .withMessage("currentPassword must contain letters and numbers"),
    body("newPassword")
        .isString()
        .isLength({ min: 8, max: 30 })
        .withMessage("newPassword must be 8-30 characters")
        .matches(/^(?=.*[A-Za-z])(?=.*\d).+$/)
        .withMessage("newPassword must contain letters and numbers"),
];