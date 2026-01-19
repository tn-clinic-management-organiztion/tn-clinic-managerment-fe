"use client";

import React from "react";
import { Search, X } from "lucide-react";

type ServiceSelectModalProps = {
  open: boolean;
  onClose: () => void;

  // data render
  services: any[];
  isLoading: boolean;

  // search + paging state (controlled from parent)
  search: string;
  onChangeSearch: (val: string) => void;

  page: number;
  totalPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;

  // choose item
  onSelect: (service: any) => void;

  // formatter
  formatVND: (value: number | string) => string;
};

export default function ServiceSelectModal({
  open,
  onClose,
  services,
  isLoading,
  search,
  onChangeSearch,
  page,
  totalPages,
  onPrevPage,
  onNextPage,
  onSelect,
  formatVND,
}: ServiceSelectModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-secondary-900/50 backdrop-blur-sm p-4">
      <div className="bg-white shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh] rounded-2xl animate-[fadeIn_0.3s_ease-out]">
        <div className="bg-primary-800 text-white p-4 flex justify-between items-center rounded-t-2xl shrink-0">
          <span className="text-lg font-bold">CHỌN DỊCH VỤ KHÁM</span>
          <button
            onClick={onClose}
            className="p-1 hover:bg-primary-700 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-4 border-b border-secondary-100 bg-bg-content">
          <div className="relative">
            <input
              type="text"
              className="w-full border border-secondary-300 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              placeholder="Nhập tên dịch vụ để tìm kiếm..."
              value={search ?? ""} // tránh null
              onChange={(e) => onChangeSearch(e.target.value)}
              autoFocus
            />
            <Search
              className="absolute left-3 top-3 text-secondary-400"
              size={18}
            />
          </div>
        </div>

        <div className="overflow-y-auto p-2 flex-1 bg-secondary-50">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-32 text-secondary-500 gap-2">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
              <span>Đang tải dữ liệu...</span>
            </div>
          ) : services.length === 0 ? (
            <div className="text-center p-8 text-secondary-500">
              Không tìm thấy dịch vụ nào.
            </div>
          ) : (
            <div className="space-y-2">
              {services.map((s) => (
                <div
                  key={s.service_id}
                  onClick={() => onSelect(s)}
                  className="bg-white p-3 rounded-lg border border-secondary-200 hover:border-primary-500 hover:shadow-md cursor-pointer transition-all flex justify-between items-center group"
                >
                  <div>
                    <div className="font-bold text-secondary-900 group-hover:text-primary-700">
                      {s.service_name}
                    </div>
                    <div className="text-xs text-secondary-500 mt-1">
                      <span className="bg-secondary-100 px-2 py-0.5 rounded">
                        {s.category?.category_name || "Dịch vụ"}
                      </span>
                    </div>
                  </div>
                  <div className="text-right font-bold text-primary-600">
                    {formatVND(s.unit_price)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-3 border-t border-secondary-200 bg-white rounded-b-2xl flex justify-between items-center">
          <span className="text-xs text-secondary-500 font-semibold">
            Trang {page} / {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={onPrevPage}
              className="px-3 py-1.5 rounded border border-secondary-300 text-xs font-bold hover:bg-secondary-100 disabled:opacity-50"
            >
              Trước
            </button>
            <button
              disabled={page >= totalPages}
              onClick={onNextPage}
              className="px-3 py-1.5 rounded bg-primary-600 text-white text-xs font-bold hover:bg-primary-700 disabled:opacity-50"
            >
              Sau
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
