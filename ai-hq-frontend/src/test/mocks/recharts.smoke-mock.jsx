import React from "react";

function container(name) {
  return function RechartsMockContainer({ children }) {
    return React.createElement(
      "div",
      {
        "data-recharts-mock": name,
      },
      children
    );
  };
}

function primitive(name) {
  return function RechartsMockPrimitive() {
    return React.createElement("span", {
      "data-recharts-mock": name,
      hidden: true,
    });
  };
}

export const ResponsiveContainer = container("ResponsiveContainer");
export const BarChart = container("BarChart");
export const LineChart = container("LineChart");
export const AreaChart = container("AreaChart");
export const ComposedChart = container("ComposedChart");
export const PieChart = container("PieChart");
export const RadialBarChart = container("RadialBarChart");
export const ScatterChart = container("ScatterChart");

export const Bar = primitive("Bar");
export const Line = primitive("Line");
export const Area = primitive("Area");
export const Pie = primitive("Pie");
export const Cell = primitive("Cell");
export const XAxis = primitive("XAxis");
export const YAxis = primitive("YAxis");
export const ZAxis = primitive("ZAxis");
export const CartesianGrid = primitive("CartesianGrid");
export const Tooltip = primitive("Tooltip");
export const Legend = primitive("Legend");
export const ReferenceLine = primitive("ReferenceLine");
export const ReferenceArea = primitive("ReferenceArea");
export const Label = primitive("Label");
export const LabelList = primitive("LabelList");
export const RadialBar = primitive("RadialBar");
export const Scatter = primitive("Scatter");

export default {
  ResponsiveContainer,
  BarChart,
  LineChart,
  AreaChart,
  ComposedChart,
  PieChart,
  RadialBarChart,
  ScatterChart,
  Bar,
  Line,
  Area,
  Pie,
  Cell,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ReferenceArea,
  Label,
  LabelList,
  RadialBar,
  Scatter,
};