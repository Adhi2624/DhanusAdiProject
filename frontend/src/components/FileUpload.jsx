import { useState } from "react";
import axios from "axios";

const API_BASE = "http://localhost:5000";

export default function FileUpload({ fetchGoogleFiles, fetchOneDriveFiles }) {
  const [file, setFile] = useState(null);

  const handleFileUpload = async (service) => {
    if (!file) return alert("Select a file first!");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const endpoint = service === "google" ? "/upload/google" : "/upload/onedrive";
      await axios.post(`${API_BASE}${endpoint}`, formData);
      alert("File uploaded!");
      service === "google" ? fetchGoogleFiles() : fetchOneDriveFiles();
    } catch (err) {
      console.error("Upload error:", err);
    }
  };

  return (
    <div className="mb-4">
      <input type="file" onChange={(e) => setFile(e.target.files[0])} />
      <button onClick={() => handleFileUpload("google")} className="ml-2 px-4 py-2 bg-blue-600 text-white rounded">
        Upload to Google
      </button>
      <button onClick={() => handleFileUpload("onedrive")} className="ml-2 px-4 py-2 bg-green-600 text-white rounded">
        Upload to OneDrive
      </button>
    </div>
  );
}
