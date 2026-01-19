"use client";

import React from "react";
import { X, Phone, MapPin } from "lucide-react";
import { Patient } from "@/types";

type Props = {
  open: boolean;
  onClose: () => void;
  results: Patient[];
  onSelect: (patient: Patient) => void;
};

export default function PatientSearchResultModal({
  open,
  onClose,
  results,
  onSelect,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-secondary-900/50 backdrop-blur-sm p-4 rounded-2xl">
      <div className="bg-white shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[80vh] animate-[fadeIn_0.4s_ease-out] rounded-2xl">
        <div className="bg-primary-900 text-white p-4 flex justify-between items-center shrink-0">
          <span className="text-lg font-bold">
            Kết quả tìm kiếm ({results.length})
          </span>

          <button
            onClick={onClose}
            className="p-1 hover:bg-primary-800 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="overflow-y-auto p-4 bg-bg-content flex-1">
          <div className="space-y-3">
            {results.map((p, index) => (
              <div
                key={p.patient_id || index}
                onClick={() => onSelect(p)}
                className="bg-white p-4 rounded-md border border-secondary-200 shadow-sm hover:border-primary-500 hover:shadow-md cursor-pointer group transition-all"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-lg text-primary-900 group-hover:text-primary-600">
                      {p.full_name}
                    </h3>

                    <div className="flex gap-4 text-xs text-secondary-500 mt-1">
                      <span>
                        <span className="font-semibold">Năm sinh:</span>{" "}
                        {p.dob ? new Date(p.dob).getFullYear() : "--"}
                      </span>
                      <span>
                        <span className="font-semibold">Giới tính:</span>{" "}
                        {p.gender}
                      </span>
                    </div>

                    <div className="mt-2 text-xs text-secondary-600 flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Phone size={12} /> {p.phone}
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin size={12} />{" "}
                        {p.address || "Chưa cập nhật địa chỉ"}
                      </div>
                    </div>
                  </div>

                  <button className="bg-white border border-primary-600 text-primary-600 px-4 py-2 rounded-md font-bold text-xs group-hover:bg-primary-600 group-hover:text-white transition-colors">
                    CHỌN
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
