import { useState, useEffect } from "react";
import axios from "axios";

const API_BASE = "http://localhost:5000"; // Change if backend is hosted elsewhere

export default function App() {
  const [googleFiles, setGoogleFiles] = useState([]);
  const [oneDriveFiles, setOneDriveFiles] = useState([]);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState({
    google: false,
    onedrive: false,
    googleUpload: false,
    onedriveUpload: false
  });
  const [activeTab, setActiveTab] = useState("google");
  const [userDetails, setUserDetails] = useState({
    google: null,
    onedrive: null
  });

  useEffect(() => {
    fetchGoogleFiles();
    fetchOneDriveFiles();
    fetchUserDetails();
  }, []);

  const fetchUserDetails = async () => {
    try {
      const googleRes = await axios.get(`${API_BASE}/user/google`);
      const onedriveRes = await axios.get(`${API_BASE}/user/onedrive`);
      
      setUserDetails({
        google: googleRes.data.user || null,
        onedrive: onedriveRes.data.user || null
      });
    } catch (err) {
      console.error("Error fetching user details:", err);
    }
  };

  const fetchGoogleFiles = async () => {
    try {
      setLoading(prev => ({ ...prev, google: true }));
      const res = await axios.get(`${API_BASE}/files/google`);
      setGoogleFiles(res.data.files || []);
    } catch (err) {
      console.error("Error fetching Google Drive files:", err);
    } finally {
      setLoading(prev => ({ ...prev, google: false }));
    }
  };

  const fetchOneDriveFiles = async () => {
    try {
      setLoading(prev => ({ ...prev, onedrive: true }));
      const res = await axios.get(`${API_BASE}/files/onedrive`);
      setOneDriveFiles(res.data.value || []);
    } catch (err) {
      console.error("Error fetching OneDrive files:", err);
    } finally {
      setLoading(prev => ({ ...prev, onedrive: false }));
    }
  };

  const handleFileUpload = async (service) => {
    if (!file) return alert("Select a file first!");
    
    const formData = new FormData();
    formData.append("file", file);

    try {
      setLoading(prev => ({ ...prev, [`${service}Upload`]: true }));
      const endpoint = service === "google" ? "/upload/google" : "/upload/onedrive";
      await axios.post(`${API_BASE}${endpoint}`, formData);
      alert("File uploaded successfully!");
      service === "google" ? fetchGoogleFiles() : fetchOneDriveFiles();
      setFile(null);
      // Reset the file input
      document.getElementById("fileInput").value = "";
    } catch (err) {
      console.error("Upload error:", err);
      alert(`Upload failed: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(prev => ({ ...prev, [`${service}Upload`]: false }));
    }
  };

  const handleDownload = async (service, fileId, fileName) => {
    try {
      const endpoint = service === "google" ? `/download/google/${fileId}` : `/download/onedrive/${fileId}`;
      window.open(`${API_BASE}${endpoint}`, "_blank");
    } catch (err) {
      console.error("Download error:", err);
    }
  };

  const handleDelete = async (service, fileId, fileName) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"?`)) return;
    
    try {
      const endpoint = service === "google" ? `/delete/google/${fileId}` : `/delete/onedrive/${fileId}`;
      await axios.delete(`${API_BASE}${endpoint}`);
      alert("File deleted successfully!");
      service === "google" ? fetchGoogleFiles() : fetchOneDriveFiles();
    } catch (err) {
      console.error("Delete error:", err);
      alert(`Delete failed: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleLogout = async (service) => {
    try {
      await axios.get(`${API_BASE}/logout/${service}`);
      alert(`Logged out from ${service === 'google' ? 'Google Drive' : 'OneDrive'} successfully!`);
      
      // Reset user details and files for the service
      setUserDetails(prev => ({
        ...prev,
        [service]: null
      }));
      
      if (service === 'google') {
        setGoogleFiles([]);
      } else {
        setOneDriveFiles([]);
      }
    } catch (err) {
      console.error("Logout error:", err);
      alert(`Logout failed: ${err.message}`);
    }
  };

  const renderFileList = (files, service) => {
    if (loading[service]) {
      return <div className="text-gray-500 italic py-4">Loading...</div>;
    }
    
    if (files.length === 0) {
      return <div className="text-gray-500 italic py-4">No files found</div>;
    }
    
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden w-full">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {files.map((file) => (
              <tr key={file.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{file.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button 
                    onClick={() => handleDownload(service, file.id, file.name)} 
                    className="text-blue-600 hover:text-blue-900 mr-4"
                  >
                    Download
                  </button>
                  <button 
                    onClick={() => handleDelete(service, file.id, file.name)} 
                    className="text-red-600 hover:text-red-900"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderUserDetails = (service) => {
    const user = userDetails[service];
    const serviceTitle = service === 'google' ? 'Google Drive' : 'OneDrive';
    const bgColor = service === 'google' ? 'bg-blue-50' : 'bg-green-50';
    const borderColor = service === 'google' ? 'border-blue-200' : 'border-green-200';
    const textColor = service === 'google' ? 'text-blue-800' : 'text-green-800';
    const buttonBg = service === 'google' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700';
    
    if (!user) {
      return (
        <div className={`rounded-lg border ${borderColor} ${bgColor} p-4 mb-4`}>
          <div className="flex justify-between items-center">
            <p className={`text-sm ${textColor}`}>Not connected to {serviceTitle}</p>
            <a 
              href={`${API_BASE}/login/${service}`}
              className={`px-4 py-2 rounded-md text-white text-sm font-medium ${buttonBg} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-${service === 'google' ? 'blue' : 'green'}-500`}
            >
              Connect
            </a>
          </div>
        </div>
      );
    }

    return (
      <div className={`rounded-lg border ${borderColor} ${bgColor} p-4 mb-4`}>
        <div className="flex justify-between items-center">
          <div className="flex flex-col">
            <p className={`font-medium ${textColor}`}>
              {user.name || user.displayName || "User"}
            </p>
            <p className={`text-sm ${textColor}`}>
              {user.email}
            </p>
          </div>
          <button 
            onClick={() => handleLogout(service)}
            className={`px-4 py-2 rounded-md text-white text-sm font-medium ${buttonBg} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-${service === 'google' ? 'blue' : 'green'}-500`}
          >
            Logout
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 w-full">
      <div className="w-full px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900">Cloud File Manager</h1>
          <p className="mt-2 text-lg text-gray-600">Manage your files across multiple cloud services</p>
        </div>
        
        {/* User Details Section */}
        <div className="bg-white rounded-lg shadow mb-8 p-6 w-full">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Account Status</h2>
          <div className="space-y-4">
            {renderUserDetails('google')}
            {renderUserDetails('onedrive')}
          </div>
        </div>
        
        {/* File Upload Section */}
        <div className="bg-white rounded-lg shadow mb-8 p-6 w-full">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Upload Files</h2>
          <div className="flex flex-col md:flex-row items-center">
            <div className="w-full md:w-1/2 mb-4 md:mb-0">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select file to upload
              </label>
              <input 
                id="fileInput"
                type="file" 
                onChange={(e) => setFile(e.target.files[0])} 
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4 w-full md:w-1/2 md:justify-end md:pl-4">
              <button 
                onClick={() => handleFileUpload("google")} 
                disabled={!file || loading.googleUpload || !userDetails.google}
                className={`py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${!file || loading.googleUpload || !userDetails.google ? 'bg-blue-300' : 'bg-blue-600 hover:bg-blue-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
              >
                {loading.googleUpload ? 'Uploading...' : 'Upload to Google'}
              </button>
              <button 
                onClick={() => handleFileUpload("onedrive")} 
                disabled={!file || loading.onedriveUpload || !userDetails.onedrive}
                className={`py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${!file || loading.onedriveUpload || !userDetails.onedrive ? 'bg-green-300' : 'bg-green-600 hover:bg-green-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500`}
              >
                {loading.onedriveUpload ? 'Uploading...' : 'Upload to OneDrive'}
              </button>
            </div>
          </div>
        </div>
        
        {/* File Browser Section */}
        <div className="bg-white rounded-lg shadow overflow-hidden w-full">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex" aria-label="Tabs">
              <button
                className={`${
                  activeTab === 'google'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm`}
                onClick={() => setActiveTab('google')}
              >
                Google Drive
              </button>
              <button
                className={`${
                  activeTab === 'onedrive'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm`}
                onClick={() => setActiveTab('onedrive')}
              >
                OneDrive
              </button>
            </nav>
          </div>
          
          <div className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-800">
                {activeTab === 'google' ? 'Google Drive Files' : 'OneDrive Files'}
              </h2>
              <button
                onClick={() => activeTab === 'google' ? fetchGoogleFiles() : fetchOneDriveFiles()}
                disabled={activeTab === 'google' ? !userDetails.google : !userDetails.onedrive}
                className={`inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md 
                  ${(activeTab === 'google' && !userDetails.google) || (activeTab === 'onedrive' && !userDetails.onedrive) 
                    ? 'text-gray-400 bg-gray-100' 
                    : 'text-blue-700 bg-blue-100 hover:bg-blue-200'} 
                  focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
              >
                Refresh
              </button>
            </div>
            
            {!userDetails[activeTab] ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Please connect your {activeTab === 'google' ? 'Google Drive' : 'OneDrive'} account to view files.</p>
              </div>
            ) : (
              activeTab === 'google' ? 
                renderFileList(googleFiles, 'google') : 
                renderFileList(oneDriveFiles, 'onedrive')
            )}
          </div>
        </div>
      </div>
    </div>
  );
}