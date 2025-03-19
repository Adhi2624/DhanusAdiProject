export default function FileList({ files, title, service, handleDownload }) {
    return (
      <div>
        <h2 className="text-xl font-semibold mt-4">{title}</h2>
        <ul className="list-disc ml-6">
          {files.map((file) => (
            <li key={file.id}>
              {file.name}
              <button onClick={() => handleDownload(service, file.id)} className="ml-2 text-blue-500">
                Download
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  