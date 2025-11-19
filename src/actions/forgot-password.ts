import { createServerFn } from '@tanstack/react-start'

export const forgotPasswordFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { email: string }) => data)
  .handler(async ({ data }) => {
    return { success: true }
  })


  export const changePasswordFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { code: string, password: string }) => data)
  .handler(async ({ data }) => {
    return { success: true }
  })
