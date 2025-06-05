
// src/services/auth-service.ts
"use server";

interface VerificationResult {
  success: boolean; // Indicates if the verification operation itself completed without issues
  isValid?: boolean; // True if password matched, false if not. Undefined if success is false.
  message?: string;  // Error message if success is false, or other informational message
}

export async function verifyPassword(submittedPassword: string): Promise<VerificationResult> {
  const serverPassword = process.env.PASSWORD;
  if (!serverPassword) {
    console.error("CRITICAL: SERVER_PASSWORD environment variable is not set. Authentication cannot proceed.");
    return { success: false, message: "Server authentication configuration error. Please contact an administrator." };
  }
  if (submittedPassword === serverPassword) {
    return { success: true, isValid: true };
  } else {
    // Operation was successful (check performed), but password was not valid
    return { success: true, isValid: false };
  }
}

