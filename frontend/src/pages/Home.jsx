import { useState, useEffect } from "react";
import axios from "axios";
import LoginButtons from "../components/LoginButton";
import FileUpload from "../components/FileUpload";
import FileList from "../components/FileList";

const API_BASE = "http://localhost:5000";

export default function Home() {
  const [googleFiles, setGoogleFiles] = useState([]);
  const [oneDriveFiles, setOneDriveFiles] = useState([]);

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
      <LoginButtons />
      <FileUpload fetchGoogleFiles={fetchGoogleFiles} fetchOneDriveFiles={fetchOneDriveFiles} />
      <FileList files={googleFiles} title="Google Drive Files" service="google" handleDownload={handleDownload} />
      <FileList files={oneDriveFiles} title="OneDrive Files" service="onedrive" handleDownload={handleDownload} />
    </div>
  );
}
