import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export type ApiRole =
  | "super_admin"
  | "hospital_admin"
  | "doctor"
  | "nurse"
  | "pharmacist"
  | "lab_technician"
  | "radiologist"
  | "receptionist"
  | "records_officer"
  | "patient"
  | "guardian"
  | "ict_admin";

export type ApiUser = {
  id: string;
  role: ApiRole;
  hospitalId: string;
  departmentId?: string;
  patientId?: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: ApiUser;
    }
  }
}

export function requireAuth(request: Request, response: Response, next: NextFunction) {
  const header = request.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) return response.status(401).json({ message: "Authentication required." });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET ?? "dev-secret") as ApiUser;
    request.user = payload;
    return next();
  } catch {
    return response.status(401).json({ message: "Invalid or expired session." });
  }
}

export function requireRole(roles: ApiRole[]) {
  return (request: Request, response: Response, next: NextFunction) => {
    if (!request.user) return response.status(401).json({ message: "Authentication required." });
    if (!roles.includes(request.user.role)) return response.status(403).json({ message: "Permission denied." });
    return next();
  };
}

