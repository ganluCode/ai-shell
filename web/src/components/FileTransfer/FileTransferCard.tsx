import { useRef, useState } from 'react'
import './FileTransferCard.css'

interface FileTransferCardProps {
  mode: 'download' | 'upload'
  // Download props
  filename?: string
  onDownload?: () => void
  // Upload props
  targetPath?: string
  uploadProgress?: number
  isUploading?: boolean
  onUpload?: (file: File) => void
}

/**
 * FileTransferCard component for SFTP download/upload interactions
 */
function FileTransferCard({
  mode,
  filename,
  onDownload,
  targetPath,
  uploadProgress = 0,
  isUploading = false,
  onUpload,
}: FileTransferCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null)

  const handleSelectFileClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFileName(file.name)
      onUpload?.(file)
    }
  }

  const isUploadComplete = uploadProgress === 100

  return (
    <div
      className="file-transfer-card"
      data-testid="file-transfer-card"
      data-mode={mode}
    >
      {mode === 'download' ? (
        // Download card
        <div className="transfer-content">
          <div className="transfer-icon download-icon">↓</div>
          <div className="transfer-info">
            <span className="filename">{filename}</span>
          </div>
          <button
            className="transfer-btn download-btn"
            onClick={onDownload}
            aria-label="下载文件"
          >
            下载
          </button>
        </div>
      ) : (
        // Upload card
        <div className="transfer-content">
          <div className="transfer-icon upload-icon">↑</div>
          <div className="transfer-info">
            <span className="target-path">{targetPath}</span>
            {selectedFileName && !isUploadComplete && (
              <span className="selected-file">{selectedFileName}</span>
            )}
          </div>

          {/* Upload progress */}
          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="upload-progress">
              <div
                className="progress-bar"
                role="progressbar"
                aria-valuenow={uploadProgress}
                aria-valuemin={0}
                aria-valuemax={100}
                style={{ width: `${uploadProgress}%` }}
              />
              <span className="progress-text">{uploadProgress}%</span>
            </div>
          )}

          {/* Upload complete state */}
          {isUploadComplete && (
            <div className="upload-complete">
              ✓ 上传完成
            </div>
          )}

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            className="file-input-hidden"
            onChange={handleFileChange}
            aria-label="选择文件"
          />

          <button
            className="transfer-btn upload-btn"
            onClick={handleSelectFileClick}
            disabled={isUploading}
            aria-label="选择文件上传"
          >
            选择文件
          </button>
        </div>
      )}
    </div>
  )
}

export default FileTransferCard
