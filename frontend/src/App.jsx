import { useState, useEffect } from "react";
import axios from "axios";

const API_BASE = "http://localhost:5000"; // Change if backend is hosted elsewhere

export default function App() {
  const [googleFiles, setGoogleFiles] = useState([]);
  const [oneDriveFiles, setOneDriveFiles] = useState([]);
  const [file, setFile] = useState(null);

  useEffect(() => {
    fetchGoogleFiles();
    fetchOneDriveFiles();
  }, []);

  const fetchGoogleFiles = async () => {
    try {
      const res = await axios.get(`${API_BASE}/files/google`);
      setGoogleFiles(res.data.files || []);
    } catch (err) {
      console.error("Error fetching Google Drive files:", err);
    }
  };

  const fetchOneDriveFiles = async () => {
    try {
      const res = await axios.get(`${API_BASE}/files/onedrive`);
      setOneDriveFiles(res.data.value || []);
    } catch (err) {
      console.error("Error fetching OneDrive files:", err);
    }
  };

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

  const handleDownload = async (service, fileId) => {
    try {
      const endpoint = service === "google" ? `/download/google/${fileId}` : `/download/onedrive/${fileId}`;
      window.open(`${API_BASE}${endpoint}`, "_blank");
    } catch (err) {
      console.error("Download error:", err);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Cloud File Manager</h1>

      {/* Login Buttons */}
      <div className="mb-4">
        <a href={`${API_BASE}/login/google`} className="mr-4 px-4 py-2 bg-blue-500 text-white rounded">Login with Google</a>
        <a href={`${API_BASE}/login/onedrive`} className="px-4 py-2 bg-green-500 text-white rounded">Login with OneDrive</a>
      </div>

      {/* File Upload */}
      <div className="mb-4">
        <input type="file" onChange={(e) => setFile(e.target.files[0])} />
        <button onClick={() => handleFileUpload("google")} className="ml-2 px-4 py-2 bg-blue-600 text-white rounded">Upload to Google</button>
        <button onClick={() => handleFileUpload("onedrive")} className="ml-2 px-4 py-2 bg-green-600 text-white rounded">Upload to OneDrive</button>
      </div>

      {/* Google Drive Files */}
      <h2 className="text-xl font-semibold mt-4">Google Drive Files</h2>
      <ul className="list-disc ml-6">
        {googleFiles.map((file) => (
          <li key={file.id}>
            {file.name} <button onClick={() => handleDownload("google", file.id)} className="ml-2 text-blue-500">Download</button>
          </li>
        ))}
      </ul>

      {/* OneDrive Files */}
      <h2 className="text-xl font-semibold mt-4">OneDrive Files</h2>
      <ul className="list-disc ml-6">
        {oneDriveFiles.map((file) => (
          <li key={file.id}>
            {file.name} <button onClick={() => handleDownload("onedrive", file.id)} className="ml-2 text-green-500">Download</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
