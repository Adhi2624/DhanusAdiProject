const API_BASE = "http://localhost:5000";

export default function LoginButtons() {
  return (
    <div className="mb-4 flex gap-4">
      <a href={`${API_BASE}/login/google`} className="px-4 py-2 bg-blue-500 text-white rounded">
        Login with Google
      </a>
      <a href={`${API_BASE}/login/onedrive`} className="px-4 py-2 bg-green-500 text-white rounded">
        Login with OneDrive
      </a>
    </div>
  );
}
