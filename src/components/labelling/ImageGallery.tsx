"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { getListResultImages, postDownloadAnnotation } from "@/services/ai-core.api";
import { uploadResultImage } from "@/services/results_image.api";
import {
  Calendar,
  User,
  Plus,
  UploadCloud,
  BrainCircuit,
  ScanEye,
  ChevronLeft,
  ChevronRight,
  Search,
  FileImage,
  AlertCircle,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { notifyError, notifySuccess } from "@/components/toast";

// --- CONFIG ---
const LIMIT = 8;

interface ImageItem {
  image_id: string;
  file_name: string;
  original_image_url: string;
  uploaded_by_name: string;
  uploaded_at: string;
  current_status:
    | "UNLABELED"
    | "IN_PROGRESS"
    | "SUBMITTED"
    | "REJECTED"
    | "APPROVED";
  has_ai_reference: boolean;
  labeled_by_name?: string;
  approved_by_name?: string;
}

export default function ImageGallery() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Data State
  const [images, setImages] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  // Pagination & Filter State
  const [activeTab, setActiveTab] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Search State
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // 1. Debounce Search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1); // Reset về trang 1 khi search
    }, 500); // Delay 0.5s
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // 2. Fetch Data
  useEffect(() => {
    fetchImages();
  }, [page, activeTab, debouncedSearch]);

  const fetchImages = async () => {
    setLoading(true);
    try {
      // Map activeTab to status string cho API
      let statusFilter = "";
      if (activeTab === "TODO") {
        statusFilter = "TODO"; // Multiple statuses
      } else if (activeTab === "REVIEW") {
        statusFilter = "REVIEW";
      } else if (activeTab === "DONE") {
        statusFilter = "DONE";
      }
      // activeTab === "ALL" thì để rỗng để lấy tất cả

      const response = await getListResultImages(
        page,
        LIMIT,
        statusFilter,
        debouncedSearch
      );

      const responseBody = response.data || response || {};
      const rawItems = responseBody.items || [];
      const meta = responseBody.meta || { total_pages: 1, total_items: 0 };

      setImages(rawItems);
      setTotalPages(meta.total_pages);
      setTotalItems(meta.total_items);
    } catch (error) {
      console.error(error);
      setImages([]);
    } finally {
      setLoading(false);
    }
  };

  // 3. Logic Filter Client (Tab)
  const filteredImages = images;

  // 4. Upload Logic
  const handleUploadClick = () => fileInputRef.current?.click();
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!session?.user.id) return;
    try {
      setIsUploading(true);
      await uploadResultImage(file, session?.user.id);
      notifySuccess("Upload thành công!");
      setPage(1);
      fetchImages();
    } catch (error) {
      notifyError("Upload thất bại.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // 5. Render Badge Status (Logic Mới)
  const renderStatusBadge = (item: ImageItem) => {
    let colorClass = "";
    let label = "";

    switch (item.current_status) {
      case "APPROVED":
        colorClass = "bg-green-100 text-green-700 border-green-200";
        label = "Đã duyệt";
        break;
      case "SUBMITTED":
        colorClass = "bg-purple-100 text-purple-700 border-purple-200";
        label = "Chờ duyệt";
        break;
      case "REJECTED":
        colorClass = "bg-red-100 text-red-700 border-red-200";
        label = "Bị từ chối";
        break;
      case "IN_PROGRESS":
        colorClass = "bg-orange-100 text-orange-700 border-orange-200";
        label = "Đang làm";
        break;
      case "UNLABELED":
      default:
        colorClass = "bg-gray-100 text-gray-600 border-gray-200";
        label = "Chưa gán nhãn";
        break;
    }

    return (
      <div className="flex flex-col gap-1 items-end">
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${colorClass}`}
        >
          {label}
        </span>
        {/* Badge AI riêng biệt */}
        {item.current_status === "UNLABELED" && item.has_ai_reference && (
          <span className="flex items-center gap-1 text-[9px] bg-yellow-50 text-yellow-700 px-1 rounded border border-yellow-200">
            <BrainCircuit size={10} /> Có gợi ý AI
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4">
      {/* --- TOP BAR: TITLE & UPLOAD --- */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Kho dữ liệu hình ảnh
          </h1>
          <p className="text-sm text-gray-500">
            Quản lý, tìm kiếm và gán nhãn dữ liệu huấn luyện AI
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              try {
                const dto = {
                  // project_id: "...",
                  // image_ids: [...],
                  // ...
                };
                await postDownloadAnnotation(dto);
              } catch (e) {
                notifyError("Tải annotations thất bại.");
              }
            }}
            disabled={isUploading}
            className="flex items-center gap-2 border-[3px] border-secondary-400 text-secondary-400 px-4 py-2 rounded-lg hover:bg-secondary-300 hover:text-secondary-100 hover:border-secondary-300 transition"
          >
            {isUploading ? (
              <UploadCloud className="animate-bounce" size={16} />
            ) : (
              <Plus size={16} />
            )}
            Tải Annotations
          </button>
          <input
            type="file"
            hidden
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
          />

          <button
            onClick={handleUploadClick}
            disabled={isUploading}
            className="flex items-center gap-2 bg-success-700 text-white px-4 py-2 rounded-lg hover:bg-success-900 transition shadow-sm text-sm font-medium"
          >
            {isUploading ? (
              <UploadCloud className="animate-bounce" size={16} />
            ) : (
              <Plus size={16} />
            )}
            Upload Ảnh Mới
          </button>
        </div>
      </div>

      {/* --- FILTER BAR: SEARCH & TABS --- */}
      <div className="bg-white p-4 rounded-xl border shadow-sm mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
        {/* Tabs */}
        <div className="flex bg-gray-100 p-1 rounded-lg">
          {[
            { id: "ALL", label: "Tất cả" },
            { id: "TODO", label: "Cần làm (Todo)" },
            { id: "REVIEW", label: "Chờ duyệt (Review)" },
            { id: "DONE", label: "Hoàn thành (Done)" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-xs font-semibold rounded-md transition-all ${
                activeTab === tab.id
                  ? "bg-white text-success-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
            size={16}
          />
          <input
            type="text"
            placeholder="Tìm theo tên ảnh, người upload..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-success-700 outline-none"
          />
        </div>
      </div>

      {/* --- GRID CONTENT --- */}
      {loading ? (
        <div className="flex justify-center py-20 text-gray-400">
          Đang tải dữ liệu...
        </div>
      ) : filteredImages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 border-2 border-dashed rounded-xl bg-gray-50/50">
          <ScanEye size={48} className="mb-3 opacity-30" />
          <p className="text-sm font-medium">Không tìm thấy ảnh nào phù hợp.</p>
          <p className="text-xs">
            Thử thay đổi bộ lọc hoặc tìm kiếm từ khóa khác.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredImages.map((img) => (
            <div
              key={img.image_id}
              onClick={() => router.push(`/annotations/${img.image_id}`)}
              className={`group bg-white rounded-lg border shadow-sm hover:shadow-md cursor-pointer transition-all overflow-hidden flex flex-col h-full ${
                img.current_status === "REJECTED" ? "ring-2 ring-red-200" : ""
              }`}
            >
              {/* IMAGE THUMBNAIL */}
              <div className="relative w-full h-48 bg-gray-100 border-b">
                <img
                  src={img.original_image_url}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  alt={img.file_name}
                />

                {/* Status Badge Overlay */}
                <div className="absolute top-2 right-2">
                  {renderStatusBadge(img)}
                </div>

                {/* Rejected Warning Overlay */}
                {img.current_status === "REJECTED" && (
                  <div className="absolute bottom-0 left-0 right-0 bg-red-100/90 text-red-700 text-[10px] px-2 py-1 font-bold flex items-center justify-center gap-1">
                    <AlertCircle size={10} /> Cần sửa lại
                  </div>
                )}
              </div>

              {/* INFO BODY */}
              <div className="p-3 text-xs text-gray-500 flex flex-col gap-2 mt-auto bg-white">
                {/* File Name */}
                <div className="flex items-center gap-2" title={img.file_name}>
                  <FileImage size={14} className="text-success-700 shrink-0" />
                  <span className="font-semibold text-gray-700 truncate">
                    {img.file_name || "No Name"}
                  </span>
                </div>

                <div className="border-t border-dashed my-1"></div>

                {/* Uploader & Date */}
                <div className="flex justify-between items-center">
                  <div
                    className="flex items-center gap-1.5"
                    title="Người upload"
                  >
                    <User size={12} className="text-gray-400" />
                    <span className="truncate max-w-[80px]">
                      {img.uploaded_by_name}
                    </span>
                  </div>
                  <div
                    className="flex items-center gap-1.5"
                    title="Ngày upload"
                  >
                    <Calendar size={12} className="text-gray-400" />
                    <span>
                      {new Date(img.uploaded_at).toLocaleDateString("vi-VN")}
                    </span>
                  </div>
                </div>

                {/* Show Labeler if assigned */}
                {["IN_PROGRESS", "SUBMITTED", "APPROVED", "REJECTED"].includes(
                  img.current_status
                ) &&
                  img.labeled_by_name && (
                    <div className="mt-1 pt-1 border-t border-gray-100 flex justify-between text-success-700">
                      <span>Labeler:</span>
                      <span className="font-semibold truncate max-w-[90px]">
                        {img.labeled_by_name}
                      </span>
                    </div>
                  )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- PAGINATION --- */}
      {!loading && totalPages > 1 && (
        <div className="flex justify-center items-center mt-8 gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 border rounded-full hover:bg-gray-100 disabled:opacity-30 bg-white shadow-sm"
          >
            <ChevronLeft size={18} />
          </button>

          <span className="text-sm font-semibold text-gray-600 bg-white px-4 py-1 rounded-full border shadow-sm">
            Trang {page} / {totalPages} (Tổng {totalItems} ảnh)
          </span>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-2 border rounded-full hover:bg-gray-100 disabled:opacity-30 bg-white shadow-sm"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
