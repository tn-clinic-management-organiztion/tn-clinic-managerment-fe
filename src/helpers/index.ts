import { RoleCode, Roles } from "@/lib/auth/role";

export function formatNumberWithCommas(number: string) {
  return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export const formatTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "--:--";
  }
};

// Helper inline để tránh import issue
export const getDefaultRoute = (role?: RoleCode) => {
  // So sánh trực tiếp với string
  if (role === "DOCTOR") return "/encounters";
  if (role === "RECEPTIONIST") return "/reception";
  if (role === "TECHNICIAN") return "/results";
  if (role === "ADMIN") return "/reception";

  console.log("No match found, returning /login");
  return "/login";
};

export const isValidVNPhone = (phone: string) => /^0\d{9}$/.test(phone.trim());

export const isValidVNCCCD = (cccd: string) => /^\d{12}$/.test(cccd.trim());
