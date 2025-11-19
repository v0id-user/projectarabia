import { formOptions } from "@tanstack/react-form";

export interface ForgotPasswordSubmission {
  email: string;
}

export interface ChangePasswordSubmission {
  code: string;
  password: string;
}

const defaultForgotPasswordSubmission: ForgotPasswordSubmission = {
  email: "",
};

const defaultChangePasswordSubmission: ChangePasswordSubmission = {
  code: "",
  password: "",
};

export const forgotPasswordFormOpts = formOptions({
  defaultValues: defaultForgotPasswordSubmission,
});

export const changePasswordFormOpts = formOptions({
  defaultValues: defaultChangePasswordSubmission,
});
