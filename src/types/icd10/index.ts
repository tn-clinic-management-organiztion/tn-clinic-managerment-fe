export interface RefIcd10 {
  icd_code: string;
  parent_code?:string;
  name_vi: string;
  name_en?:string;
  level?: number;
  is_leaf: boolean;
  is_active: boolean;
};
