export interface ImageResult {
  image_id: string;
  original_image_url: string;
  file_name?: string;
  annotations?: {
    annotation_id: string;
    annotation_data: any[];
    ai_model_name?: string;
  }[];
};

export interface ServiceResult {
  result_id: string;
  request_item_id: string;
  technician_id: string;
  main_conclusion?: string;
  report_body_html?: string;
  is_abnormal: boolean;
  result_time: string;
  images?: ImageResult[];
};

export interface ServiceRequestItem {
  item_id: string;
  request_id: string;
  service_id: number;
};

export interface Service {
  service_id: number;
  category_id?: number;
  service_name: string;
  unit_price: number;
  category?: ServiceCategory;
};

export interface ServiceCategory {
  category_id: number;
  category_name: string;
  parent_id?: number | null;
  is_system_root: boolean;
};
// ====== Payload
export interface ChooseServiceRequestItem {
  service_id: number;
}

export interface CreateServiceRequestPayload {
  encounter_id: string;
  requesting_doctor_id: string;
  notes?: string;
  items?: ChooseServiceRequestItem[];
}

export interface UpdateServiceRequestPayload
  extends Partial<CreateServiceRequestPayload> {
}