import { verifyToken } from "@clerk/backend";

function missingKeyError() {
  const err = new Error(
    "CLERK_SECRET_KEY is not configured. Add it to your environment variables."
  );
  err.status = 500;
  return err;
}

function unauthorizedError(message) {
  const err = new Error(message);
  err.status = 401;
  return err;
}

async function extractAndVerify(req) {
  if (!process.env.CLERK_SECRET_KEY) {
    throw missingKeyError();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw unauthorizedError("Authentication required.");
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY
    });
    return { userId: payload.sub };
  } catch {
    throw unauthorizedError("Invalid or expired session token.");
  }
}

// Use in routes that require a signed-in user.
// Returns { userId } or throws an error with a .status property.
export async function requireAuth(req) {
  return extractAndVerify(req);
}

// Use in routes where auth is optional (e.g. publish-site).
// Returns { userId } if a valid token is present, or { userId: null } if not.
export async function optionalAuth(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { userId: null };
  }

  if (!process.env.CLERK_SECRET_KEY) {
    return { userId: null };
  }

  try {
    return await extractAndVerify(req);
  } catch {
    return { userId: null };
  }
}
