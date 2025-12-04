/**
 * Media Processing Utility
 */

import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Logger } from './Logger';

export interface MediaProcessingOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp' | 'mp4' | 'mp3' | 'opus';
  compress?: boolean;
  generateThumbnail?: boolean;
  stripMetadata?: boolean;
}

export interface ProcessedMedia {
  buffer: Buffer;
  thumbnail?: Buffer;
  metadata: MediaMetadata;
  originalSize: number;
  processedSize: number;
  compressionRatio: number;
}

export interface MediaMetadata {
  width?: number;
  height?: number;
  duration?: number;
  format: string;
  size: number;
  mimeType: string;
  hasAudio?: boolean;
  hasVideo?: boolean;
  pages?: number;
}

export class MediaProcessor {
  private logger: Logger;
  private supportedImageFormats = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff'];
  private supportedVideoFormats = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'];
  private supportedAudioFormats = ['mp3', 'wav', 'ogg', 'opus', 'm4a', 'aac'];

  constructor(logger?: Logger) {
    this.logger = logger || new Logger('MediaProcessor');
  }

  public async processImage(
    input: Buffer | string,
    options: MediaProcessingOptions = {}
  ): Promise<ProcessedMedia> {
    const startTime = Date.now();
    
    try {
      const defaultOptions: MediaProcessingOptions = {
        maxWidth: 1024,
        maxHeight: 1024,
        quality: 80,
        format: 'jpeg',
        compress: true,
        generateThumbnail: true,
        stripMetadata: true
      };

      const finalOptions = { ...defaultOptions, ...options };
      
      // Read input if it's a file path
      const inputBuffer = typeof input === 'string' ? await fs.readFile(input) : input;
      const originalSize = inputBuffer.length;

      // Process image with Sharp
      let processor = sharp(inputBuffer);

      // Resize if dimensions are specified
      if (finalOptions.maxWidth || finalOptions.maxHeight) {
        processor = processor.resize(
          finalOptions.maxWidth,
          finalOptions.maxHeight,
          {
            fit: 'inside',
            withoutEnlargement: true
          }
        );
      }

      // Strip metadata if requested
      if (finalOptions.stripMetadata) {
        processor = processor.withMetadata(false);
      }

      // Set format and quality
      switch (finalOptions.format) {
        case 'jpeg':
          processor = processor.jpeg({ quality: finalOptions.quality });
          break;
        case 'png':
          processor = processor.png({ compressionLevel: 9 });
          break;
        case 'webp':
          processor = processor.webp({ quality: finalOptions.quality });
          break;
        default:
          processor = processor.jpeg({ quality: finalOptions.quality });
      }

      // Get metadata
      const metadata = await this.getImageMetadata(inputBuffer);
      
      // Process the image
      const processedBuffer = await processor.toBuffer();
      const processedSize = processedBuffer.length;
      const compressionRatio = originalSize > 0 ? processedSize / originalSize : 1;

      // Generate thumbnail if requested
      let thumbnail: Buffer | undefined;
      if (finalOptions.generateThumbnail) {
        thumbnail = await this.generateThumbnail(inputBuffer, 200, 200);
      }

      // Update metadata with processed information
      metadata.size = processedSize;
      metadata.mimeType = `image/${finalOptions.format}`;

      const result: ProcessedMedia = {
        buffer: processedBuffer,
        thumbnail,
        metadata,
        originalSize,
        processedSize,
        compressionRatio
      };

      this.logger.info(`Image processed in ${Date.now() - startTime}ms`, {
        originalSize,
        processedSize,
        compressionRatio: `${(compressionRatio * 100).toFixed(1)}%`
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to process image:', error);
      throw error;
    }
  }

  public async processVideo(
    input: Buffer | string,
    options: MediaProcessingOptions = {}
  ): Promise<ProcessedMedia> {
    const startTime = Date.now();
    
    try {
      const defaultOptions: MediaProcessingOptions = {
        format: 'mp4',
        compress: true,
        generateThumbnail: true
      };

      const finalOptions = { ...defaultOptions, ...options };
      
      // For video processing, we'll need ffmpeg integration
      // For now, we'll return the original video with metadata
      const inputBuffer = typeof input === 'string' ? await fs.readFile(input) : input;
      const originalSize = inputBuffer.length;

      const metadata = await this.getVideoMetadata(inputBuffer);

      // Generate thumbnail if requested
      let thumbnail: Buffer | undefined;
      if (finalOptions.generateThumbnail) {
        thumbnail = await this.generateVideoThumbnail(inputBuffer);
      }

      const result: ProcessedMedia = {
        buffer: inputBuffer, // Return original for now
        thumbnail,
        metadata,
        originalSize,
        processedSize: originalSize,
        compressionRatio: 1
      };

      this.logger.info(`Video processed in ${Date.now() - startTime}ms`);

      return result;
    } catch (error) {
      this.logger.error('Failed to process video:', error);
      throw error;
    }
  }

  public async processAudio(
    input: Buffer | string,
    options: MediaProcessingOptions = {}
  ): Promise<ProcessedMedia> {
    const startTime = Date.now();
    
    try {
      const defaultOptions: MediaProcessingOptions = {
        format: 'opus',
        compress: true
      };

      const finalOptions = { ...defaultOptions, ...options };
      
      const inputBuffer = typeof input === 'string' ? await fs.readFile(input) : input;
      const originalSize = inputBuffer.length;

      const metadata = await this.getAudioMetadata(inputBuffer);

      const result: ProcessedMedia = {
        buffer: inputBuffer, // Return original for now
        metadata,
        originalSize,
        processedSize: originalSize,
        compressionRatio: 1
      };

      this.logger.info(`Audio processed in ${Date.now() - startTime}ms`);

      return result;
    } catch (error) {
      this.logger.error('Failed to process audio:', error);
      throw error;
    }
  }

  public async generateThumbnail(
    input: Buffer,
    width: number = 200,
    height: number = 200
  ): Promise<Buffer> {
    try {
      const thumbnail = await sharp(input)
        .resize(width, height, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 70 })
        .toBuffer();

      return thumbnail;
    } catch (error) {
      this.logger.error('Failed to generate thumbnail:', error);
      throw error;
    }
  }

  public async generateVideoThumbnail(input: Buffer): Promise<Buffer> {
    // This would require ffmpeg integration
    // For now, return a placeholder
    this.logger.warn('Video thumbnail generation requires ffmpeg integration');
    throw new Error('Video thumbnail generation not implemented yet');
  }

  public async getImageMetadata(buffer: Buffer): Promise<MediaMetadata> {
    try {
      const metadata = await sharp(buffer).metadata();
      
      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format || 'unknown',
        size: buffer.length,
        mimeType: `image/${metadata.format}`,
        pages: metadata.pages
      };
    } catch (error) {
      this.logger.error('Failed to get image metadata:', error);
      throw error;
    }
  }

  public async getVideoMetadata(buffer: Buffer): Promise<MediaMetadata> {
    // This would require ffprobe integration
    // For now, return basic metadata
    return {
      format: 'mp4',
      size: buffer.length,
      mimeType: 'video/mp4',
      hasVideo: true,
      hasAudio: true
    };
  }

  public async getAudioMetadata(buffer: Buffer): Promise<MediaMetadata> {
    // This would require ffprobe integration
    // For now, return basic metadata
    return {
      format: 'opus',
      size: buffer.length,
      mimeType: 'audio/opus',
      hasAudio: true
    };
  }

  public isValidImageFormat(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase().slice(1);
    return this.supportedImageFormats.includes(ext);
  }

  public isValidVideoFormat(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase().slice(1);
    return this.supportedVideoFormats.includes(ext);
  }

  public isValidAudioFormat(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase().slice(1);
    return this.supportedAudioFormats.includes(ext);
  }

  public getMediaType(filename: string): 'image' | 'video' | 'audio' | 'unknown' {
    if (this.isValidImageFormat(filename)) return 'image';
    if (this.isValidVideoFormat(filename)) return 'video';
    if (this.isValidAudioFormat(filename)) return 'audio';
    return 'unknown';
  }

  public async optimizeForWhatsApp(
    input: Buffer | string,
    mediaType: 'image' | 'video' | 'audio'
  ): Promise<ProcessedMedia> {
    const options: MediaProcessingOptions = {
      // WhatsApp optimal settings
      maxWidth: 1024,
      maxHeight: 1024,
      quality: 80,
      compress: true,
      generateThumbnail: mediaType === 'image' || mediaType === 'video',
      stripMetadata: true
    };

    switch (mediaType) {
      case 'image':
        return this.processImage(input, options);
      case 'video':
        return this.processVideo(input, options);
      case 'audio':
        return this.processAudio(input, options);
      default:
        throw new Error(`Unsupported media type: ${mediaType}`);
    }
  }

  public async convertFormat(
    input: Buffer | string,
    targetFormat: string,
    options: MediaProcessingOptions = {}
  ): Promise<ProcessedMedia> {
    const mediaType = this.getMediaType(typeof input === 'string' ? input : 'unknown');
    
    if (mediaType === 'image') {
      return this.processImage(input, { ...options, format: targetFormat as any });
    } else if (mediaType === 'video') {
      return this.processVideo(input, { ...options, format: targetFormat as any });
    } else if (mediaType === 'audio') {
      return this.processAudio(input, { ...options, format: targetFormat as any });
    } else {
      throw new Error('Cannot determine media type for conversion');
    }
  }

  public async compressImage(
    input: Buffer,
    quality: number = 70
  ): Promise<Buffer> {
    try {
      return await sharp(input)
        .jpeg({ quality })
        .toBuffer();
    } catch (error) {
      this.logger.error('Failed to compress image:', error);
      throw error;
    }
  }

  public async resizeImage(
    input: Buffer,
    width: number,
    height: number,
    fit: 'cover' | 'contain' | 'fill' | 'inside' | 'outside' = 'inside'
  ): Promise<Buffer> {
    try {
      return await sharp(input)
        .resize(width, height, { fit })
        .toBuffer();
    } catch (error) {
      this.logger.error('Failed to resize image:', error);
      throw error;
    }
  }

  public async addWatermark(
    input: Buffer,
    watermarkText: string,
    position: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' = 'bottom-right'
  ): Promise<Buffer> {
    try {
      const metadata = await sharp(input).metadata();
      if (!metadata.width || !metadata.height) {
        throw new Error('Could not determine image dimensions');
      }

      // Create text overlay (simplified version)
      const svgText = `
        <svg width="${metadata.width}" height="${metadata.height}">
          <text 
            x="${this.getWatermarkX(position, metadata.width)}" 
            y="${this.getWatermarkY(position, metadata.height)}" 
            font-family="Arial" 
            font-size="24" 
            fill="white" 
            fill-opacity="0.7"
            stroke="black"
            stroke-width="1"
          >
            ${watermarkText}
          </text>
        </svg>
      `;

      return await sharp(input)
        .composite([{ input: Buffer.from(svgText), top: 0, left: 0 }])
        .toBuffer();
    } catch (error) {
      this.logger.error('Failed to add watermark:', error);
      throw error;
    }
  }

  private getWatermarkX(position: string, width: number): number {
    switch (position) {
      case 'center':
        return width / 2;
      case 'top-left':
      case 'bottom-left':
        return 20;
      case 'top-right':
      case 'bottom-right':
        return width - 100;
      default:
        return width - 100;
    }
  }

  private getWatermarkY(position: string, height: number): number {
    switch (position) {
      case 'center':
        return height / 2;
      case 'top-left':
      case 'top-right':
        return 40;
      case 'bottom-left':
      case 'bottom-right':
        return height - 20;
      default:
        return height - 20;
    }
  }

  public async createCollage(
    images: Buffer[],
    cols: number = 2,
    rows: number = 2
  ): Promise<Buffer> {
    try {
      if (images.length !== cols * rows) {
        throw new Error(`Number of images (${images.length}) must match grid size (${cols}x${rows})`);
      }

      // Get metadata for all images to determine consistent dimensions
      const metadataList = await Promise.all(
        images.map(img => sharp(img).metadata())
      );

      const targetWidth = Math.max(...metadataList.map(m => m.width || 0));
      const targetHeight = Math.max(...metadataList.map(m => m.height || 0));

      // Process each image to consistent dimensions
      const processedImages = await Promise.all(
        images.map(img =>
          sharp(img)
            .resize(targetWidth, targetHeight, { fit: 'cover' })
            .toBuffer()
        )
      );

      // Create composite image
      const compositeImage = await sharp({
        create: {
          width: targetWidth * cols,
          height: targetHeight * rows,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        }
      }).composite(
        processedImages.map((img, index) => ({
          input: img,
          left: (index % cols) * targetWidth,
          top: Math.floor(index / cols) * targetHeight
        }))
      ).toBuffer();

      return compositeImage;
    } catch (error) {
      this.logger.error('Failed to create collage:', error);
      throw error;
    }
  }
}

export default MediaProcessor;