export enum AIModel {
  YOLOV12N = "yolov12n",
  YOLOV12S = "yolov12s",
  YOLOV12M = "yolov12m",
}

export interface NormalizedDetection {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
  confidence: number;
  classId: number;
};