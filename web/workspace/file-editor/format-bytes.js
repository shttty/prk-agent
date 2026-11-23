
export const formatBytes = (value) => (value >= 1048576 ? `${(value / 1048576).toFixed(1)} MB` : value >= 1024 ? `${Math.round(value / 1024)} KB` : `${value} B`);
