import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import FileTransferCard from './FileTransferCard'

describe('FileTransferCard', () => {
  const mockOnDownload = vi.fn()
  const mockOnUpload = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Download card', () => {
    it('renders download card with filename and download button', () => {
      render(
        <FileTransferCard
          mode="download"
          filename="test-file.txt"
          onDownload={mockOnDownload}
        />
      )

      expect(screen.getByText('test-file.txt')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /下载/i })).toBeInTheDocument()
    })

    it('triggers browser file save when download button is clicked', async () => {
      const user = userEvent.setup()
      render(
        <FileTransferCard
          mode="download"
          filename="data.json"
          onDownload={mockOnDownload}
        />
      )

      const downloadButton = screen.getByRole('button', { name: /下载/i })
      await user.click(downloadButton)

      expect(mockOnDownload).toHaveBeenCalledTimes(1)
    })

    it('shows download icon in download mode', () => {
      render(
        <FileTransferCard
          mode="download"
          filename="report.pdf"
          onDownload={mockOnDownload}
        />
      )

      const card = screen.getByTestId('file-transfer-card')
      expect(card).toHaveAttribute('data-mode', 'download')
    })
  })

  describe('Upload card', () => {
    it('renders upload card with target path and select file button', () => {
      render(
        <FileTransferCard
          mode="upload"
          targetPath="/home/user/documents/"
          onUpload={mockOnUpload}
        />
      )

      expect(screen.getByText('/home/user/documents/')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /选择文件/i })).toBeInTheDocument()
    })

    it('opens file picker and uploads file when button is clicked', async () => {
      const user = userEvent.setup()

      // Create a mock file
      const mockFile = new File(['test content'], 'upload-test.txt', { type: 'text/plain' })

      render(
        <FileTransferCard
          mode="upload"
          targetPath="/home/user/"
          onUpload={mockOnUpload}
        />
      )

      // Get the hidden file input by its exact aria-label
      const fileInput = screen.getByLabelText('选择文件') as HTMLInputElement

      // Simulate file selection
      await user.upload(fileInput, mockFile)

      await waitFor(() => {
        expect(mockOnUpload).toHaveBeenCalledWith(mockFile)
      })
    })

    it('shows upload progress when uploading', () => {
      render(
        <FileTransferCard
          mode="upload"
          targetPath="/home/user/"
          uploadProgress={45}
          onUpload={mockOnUpload}
        />
      )

      expect(screen.getByText(/45%/)).toBeInTheDocument()
      // Progress bar should be visible
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })

    it('shows upload icon in upload mode', () => {
      render(
        <FileTransferCard
          mode="upload"
          targetPath="/tmp/"
          onUpload={mockOnUpload}
        />
      )

      const card = screen.getByTestId('file-transfer-card')
      expect(card).toHaveAttribute('data-mode', 'upload')
    })

    it('disables upload button while upload is in progress', () => {
      render(
        <FileTransferCard
          mode="upload"
          targetPath="/tmp/"
          uploadProgress={50}
          isUploading={true}
          onUpload={mockOnUpload}
        />
      )

      const selectButton = screen.getByRole('button', { name: /选择文件/i })
      expect(selectButton).toBeDisabled()
    })

    it('shows completed state when upload finishes', () => {
      render(
        <FileTransferCard
          mode="upload"
          targetPath="/tmp/"
          uploadProgress={100}
          onUpload={mockOnUpload}
        />
      )

      expect(screen.getByText(/上传完成/i)).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper aria-label for download button', () => {
      render(
        <FileTransferCard
          mode="download"
          filename="file.txt"
          onDownload={mockOnDownload}
        />
      )

      const downloadButton = screen.getByRole('button', { name: /下载/i })
      expect(downloadButton).toHaveAttribute('aria-label', '下载文件')
    })

    it('has proper aria-label for upload button', () => {
      render(
        <FileTransferCard
          mode="upload"
          targetPath="/tmp/"
          onUpload={mockOnUpload}
        />
      )

      const uploadButton = screen.getByRole('button', { name: /选择文件/i })
      expect(uploadButton).toHaveAttribute('aria-label', '选择文件上传')
    })

    it('progress bar has proper aria attributes', () => {
      render(
        <FileTransferCard
          mode="upload"
          targetPath="/tmp/"
          uploadProgress={30}
          onUpload={mockOnUpload}
        />
      )

      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-valuenow', '30')
      expect(progressBar).toHaveAttribute('aria-valuemin', '0')
      expect(progressBar).toHaveAttribute('aria-valuemax', '100')
    })
  })
})
