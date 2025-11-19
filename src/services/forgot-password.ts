import bcrypt from "bcryptjs";
import { env } from "cloudflare:workers";
import { findUserByEmail } from "@/db/queries/users";
import { updateUserPassword } from "@/db/queries/users";
import {
  findVerificationByToken,
  deleteVerificationByUserId,
} from "@/db/queries/verifications";
import { upsertVerification } from "./verifications";
import { sendEmail } from "@/lib/email";
import { validateEmail, validatePassword } from "./validation";
import { logger } from "@/lib/logger";

// Password hashing with bcrypt
async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

/**
 * Request password reset - validates email, creates token, sends reset email
 */
export async function requestPasswordReset(
  email: string,
): Promise<
  | { success: true }
  | { success: false; error: string; errorCode: string }
> {
  // Validate email format
  const emailValidation = validateEmail(email);
  if (!emailValidation.valid) {
    return {
      success: false,
      error: emailValidation.error ?? "البريد الإلكتروني غير صالح",
      errorCode: emailValidation.errorCode ?? "INVALID_EMAIL",
    };
  }

  // Check if email is provided (validateEmail allows empty, but we need it here)
  if (!email || email.trim() === "") {
    return {
      success: false,
      error: "البريد الإلكتروني مطلوب",
      errorCode: "EMAIL_REQUIRED",
    };
  }

  // Find user by email
  const user = await findUserByEmail(email);
  if (!user) {
    // Don't reveal if email exists or not for security
    logger.info("forgot-password:requestPasswordReset", {
      email,
      userFound: false,
    });
    // Return success anyway to prevent email enumeration
    return { success: true };
  }

  logger.info("forgot-password:requestPasswordReset", {
    email,
    userId: user.id,
    userFound: true,
  });

  // Create verification token
  const token = await upsertVerification(user.id);

  // Send reset email
  try {
    await sendEmail(
      "reset",
      {
        to: email,
        link: `${env.DOMAIN}/password/${token}`,
      },
      process.env.RESEND_API_KEY,
    );

    logger.info("forgot-password:requestPasswordReset:emailSent", {
      email,
      userId: user.id,
    });
  } catch (error) {
    logger.error("forgot-password:requestPasswordReset:emailError", {
      email,
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    });
    // Still return success to prevent email enumeration
    return { success: true };
  }

  return { success: true };
}

/**
 * Change password using verification code
 */
export async function changePasswordWithCode(
  code: string,
  newPassword: string,
): Promise<
  | { success: true }
  | { success: false; error: string; errorCode: string }
> {
  // Validate password strength
  const passwordValidation = validatePassword(newPassword);
  if (!passwordValidation.valid) {
    return {
      success: false,
      error: passwordValidation.error ?? "كلمة المرور غير صالحة",
      errorCode: passwordValidation.errorCode ?? "INVALID_PASSWORD",
    };
  }

  // Find verification by token
  const verification = await findVerificationByToken(code);
  if (!verification) {
    logger.warn("forgot-password:changePasswordWithCode", {
      code,
      verificationFound: false,
    });
    return {
      success: false,
      error: "رمز التحقق غير صالح أو منتهي الصلاحية",
      errorCode: "INVALID_CODE",
    };
  }

  logger.info("forgot-password:changePasswordWithCode", {
    userId: verification.userId,
    verificationFound: true,
  });

  // Hash new password
  const hashedPassword = await hashPassword(newPassword);

  // Update user password
  await updateUserPassword(verification.userId, hashedPassword);

  // Delete verification token to prevent reuse
  await deleteVerificationByUserId(verification.userId);

  logger.info("forgot-password:changePasswordWithCode:success", {
    userId: verification.userId,
  });

  return { success: true };
}

