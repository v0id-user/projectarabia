import { createServerFn } from "@tanstack/react-start";
import type {
  ForgotPasswordSubmission,
  ChangePasswordSubmission,
} from "@/schemas/auth/forgot-password";
import {
  requestPasswordReset,
  changePasswordWithCode,
} from "@/services/forgot-password";
import { findVerificationByToken } from "@/db/queries/verifications";
import { logger } from "@/lib/logger";

export const forgotPasswordFn = createServerFn({ method: "POST" })
  .inputValidator((data: ForgotPasswordSubmission) => data)
  .handler(async ({ data }) => {
    logger.info("forgotPasswordFn", {
      tag: "forgotPasswordFn",
      email: data.email,
    });

    const result = await requestPasswordReset(data.email);

    if (!result.success) {
      logger.warn("forgotPasswordFn", {
        tag: "forgotPasswordFn",
        email: data.email,
        error: result.error,
        errorCode: result.errorCode,
      });
      return {
        error: result.error,
        errorCode: result.errorCode,
      };
    }

    logger.info("forgotPasswordFn", {
      tag: "forgotPasswordFn",
      action: "success",
      email: data.email,
    });

    return { success: true };
  });

export const changePasswordFn = createServerFn({ method: "POST" })
  .inputValidator((data: ChangePasswordSubmission) => data)
  .handler(async ({ data }) => {
    logger.info("changePasswordFn", {
      tag: "changePasswordFn",
      codeProvided: !!data.code,
    });

    const result = await changePasswordWithCode(data.code, data.password);

    if (!result.success) {
      logger.warn("changePasswordFn", {
        tag: "changePasswordFn",
        error: result.error,
        errorCode: result.errorCode,
      });
      return {
        error: result.error,
        errorCode: result.errorCode,
      };
    }

    logger.info("changePasswordFn", {
      tag: "changePasswordFn",
      action: "success",
    });

    return { success: true };
  });

export const validateResetCodeFn = createServerFn({ method: "GET" })
  .inputValidator((data: { code: string }) => data)
  .handler(async ({ data }) => {
    logger.info("validateResetCodeFn", {
      tag: "validateResetCodeFn",
      codeProvided: !!data.code,
    });

    const verification = await findVerificationByToken(data.code);

    if (!verification) {
      logger.warn("validateResetCodeFn", {
        tag: "validateResetCodeFn",
        action: "invalid_code",
      });
      return {
        success: false,
        error: "رمز التحقق غير صالح أو منتهي الصلاحية",
      };
    }

    logger.info("validateResetCodeFn", {
      tag: "validateResetCodeFn",
      action: "code_valid",
      userId: verification.userId,
    });

    return { success: true };
  });
