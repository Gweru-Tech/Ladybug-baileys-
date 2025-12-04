/**
 * Input Validation Utility
 */

import Joi from 'joi';
import { WAMessageContent } from '@whiskeysockets/baileys';
import { ValidationError } from '../types';

export interface SendMessageRequest {
  jid: string;
  content: WAMessageContent;
  options?: any;
}

export interface ScheduleMessageRequest extends SendMessageRequest {
  scheduleTime: Date;
}

export class Validator {
  private jidSchema = Joi.string()
    .pattern(/^(\\d+|\\d+-\\d+)@(s\\.whatsapp\\.net|g\\.us|broadcast)$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid WhatsApp JID format',
      'any.required': 'JID is required'
    });

  private phoneNumberSchema = Joi.string()
    .pattern(/^\\d+$/)
    .min(10)
    .max(15)
    .required()
    .messages({
      'string.pattern.base': 'Phone number must contain only digits',
      'string.min': 'Phone number must be at least 10 digits',
      'string.max': 'Phone number must be at most 15 digits',
      'any.required': 'Phone number is required'
    });

  private textMessageSchema = Joi.object({
    text: Joi.string().min(1).max(4096).required()
  });

  private imageMessageSchema = Joi.object({
    image: Joi.alternatives()
      .try(
        Joi.string().uri(),
        Joi.object(),
        Joi.binary()
      )
      .required(),
    caption: Joi.string().max(1024).optional(),
    viewOnce: Joi.boolean().optional()
  });

  private videoMessageSchema = Joi.object({
    video: Joi.alternatives()
      .try(
        Joi.string().uri(),
        Joi.object(),
        Joi.binary()
      )
      .required(),
    caption: Joi.string().max(1024).optional(),
    gifPlayback: Joi.boolean().optional(),
    ptv: Joi.boolean().optional(),
    viewOnce: Joi.boolean().optional()
  });

  private audioMessageSchema = Joi.object({
    audio: Joi.alternatives()
      .try(
        Joi.string().uri(),
        Joi.object(),
        Joi.binary()
      )
      .required(),
    mimetype: Joi.string().optional(),
    ptt: Joi.boolean().optional(),
    viewOnce: Joi.boolean().optional()
  });

  private documentMessageSchema = Joi.object({
    document: Joi.alternatives()
      .try(
        Joi.string().uri(),
        Joi.object(),
        Joi.binary()
      )
      .required(),
    caption: Joi.string().max(1024).optional(),
    fileName: Joi.string().optional(),
    mimetype: Joi.string().optional(),
    viewOnce: Joi.boolean().optional()
  });

  private locationMessageSchema = Joi.object({
    location: Joi.object({
      degreesLatitude: Joi.number().min(-90).max(90).required(),
      degreesLongitude: Joi.number().min(-180).max(180).required(),
      name: Joi.string().optional(),
      address: Joi.string().optional(),
      url: Joi.string().uri().optional(),
      jpegThumbnail: Joi.binary().optional()
    }).required()
  });

  private contactMessageSchema = Joi.object({
    contacts: Joi.object({
      displayName: Joi.string().required(),
      contacts: Joi.array().items(
        Joi.object({
          vcard: Joi.string().required()
        })
      ).required()
    }).required()
  });

  private pollMessageSchema = Joi.object({
    poll: Joi.object({
      name: Joi.string().min(1).max(100).required(),
      values: Joi.array().items(Joi.string().min(1).max(50)).min(2).max(12).required(),
      selectableCount: Joi.number().min(1).max(10).required(),
      toAnnouncementGroup: Joi.boolean().optional()
    }).required()
  });

  private reactionMessageSchema = Joi.object({
    react: Joi.object({
      text: Joi.string().max(1).required(),
      key: Joi.object({
        remoteJid: this.jidSchema,
        id: Joi.string().required(),
        fromMe: Joi.boolean().required()
      }).required()
    }).required()
  });

  private scheduleTimeSchema = Joi.date()
    .min('now')
    .max(Date.now() + 365 * 24 * 60 * 60 * 1000) // Max 1 year in future
    .required()
    .messages({
      'date.min': 'Schedule time must be in the future',
      'date.max': 'Schedule time cannot be more than 1 year in the future',
      'any.required': 'Schedule time is required'
    });

  // Main validation methods
  public validateSendMessage(data: SendMessageRequest): void {
    const { error } = this.sendMessageSchema.validate(data);
    if (error) {
      throw new ValidationError(`Invalid send message request: ${error.details[0].message}`);
    }
  }

  public validateScheduleMessage(data: ScheduleMessageRequest): void {
    const { error } = this.scheduleMessageSchema.validate(data);
    if (error) {
      throw new ValidationError(`Invalid schedule message request: ${error.details[0].message}`);
    }
  }

  public validateJID(jid: string): void {
    const { error } = this.jidSchema.validate(jid);
    if (error) {
      throw new ValidationError(`Invalid JID: ${error.details[0].message}`);
    }
  }

  public validatePhoneNumber(phoneNumber: string): void {
    const { error } = this.phoneNumberSchema.validate(phoneNumber);
    if (error) {
      throw new ValidationError(`Invalid phone number: ${error.details[0].message}`);
    }
  }

  public validateScheduleTime(scheduleTime: Date): void {
    const { error } = this.scheduleTimeSchema.validate(scheduleTime);
    if (error) {
      throw new ValidationError(`Invalid schedule time: ${error.details[0].message}`);
    }
  }

  // Content type validation
  public validateTextMessage(content: any): void {
    const { error } = this.textMessageSchema.validate(content);
    if (error) {
      throw new ValidationError(`Invalid text message: ${error.details[0].message}`);
    }
  }

  public validateImageMessage(content: any): void {
    const { error } = this.imageMessageSchema.validate(content);
    if (error) {
      throw new ValidationError(`Invalid image message: ${error.details[0].message}`);
    }
  }

  public validateVideoMessage(content: any): void {
    const { error } = this.videoMessageSchema.validate(content);
    if (error) {
      throw new ValidationError(`Invalid video message: ${error.details[0].message}`);
    }
  }

  public validateAudioMessage(content: any): void {
    const { error } = this.audioMessageSchema.validate(content);
    if (error) {
      throw new ValidationError(`Invalid audio message: ${error.details[0].message}`);
    }
  }

  public validateDocumentMessage(content: any): void {
    const { error } = this.documentMessageSchema.validate(content);
    if (error) {
      throw new ValidationError(`Invalid document message: ${error.details[0].message}`);
    }
  }

  public validateLocationMessage(content: any): void {
    const { error } = this.locationMessageSchema.validate(content);
    if (error) {
      throw new ValidationError(`Invalid location message: ${error.details[0].message}`);
    }
  }

  public validateContactMessage(content: any): void {
    const { error } = this.contactMessageSchema.validate(content);
    if (error) {
      throw new ValidationError(`Invalid contact message: ${error.details[0].message}`);
    }
  }

  public validatePollMessage(content: any): void {
    const { error } = this.pollMessageSchema.validate(content);
    if (error) {
      throw new ValidationError(`Invalid poll message: ${error.details[0].message}`);
    }
  }

  public validateReactionMessage(content: any): void {
    const { error } = this.reactionMessageSchema.validate(content);
    if (error) {
      throw new ValidationError(`Invalid reaction message: ${error.details[0].message}`);
    }
  }

  // Utility validation methods
  public validateURL(url: string): void {
    const urlSchema = Joi.string().uri().required();
    const { error } = urlSchema.validate(url);
    if (error) {
      throw new ValidationError(`Invalid URL: ${error.details[0].message}`);
    }
  }

  public validateEmail(email: string): void {
    const emailSchema = Joi.string().email().required();
    const { error } = emailSchema.validate(email);
    if (error) {
      throw new ValidationError(`Invalid email: ${error.details[0].message}`);
    }
  }

  public validateWebhookUrl(url: string): void {
    const webhookSchema = Joi.string()
      .uri()
      .pattern(/^https?:\\/\\//)
      .required()
      .messages({
        'string.pattern.base': 'Webhook URL must use HTTP or HTTPS protocol'
      });
    
    const { error } = webhookSchema.validate(url);
    if (error) {
      throw new ValidationError(`Invalid webhook URL: ${error.details[0].message}`);
    }
  }

  public validateApiKey(apiKey: string): void {
    const apiKeySchema = Joi.string()
      .min(16)
      .max(256)
      .pattern(/^[a-zA-Z0-9-_]+$/)
      .required()
      .messages({
        'string.min': 'API key must be at least 16 characters long',
        'string.max': 'API key must be at most 256 characters long',
        'string.pattern.base': 'API key can only contain alphanumeric characters, hyphens, and underscores'
      });
    
    const { error } = apiKeySchema.validate(apiKey);
    if (error) {
      throw new ValidationError(`Invalid API key: ${error.details[0].message}`);
    }
  }

  // Business logic validation
  public validateMessageBatch(messages: SendMessageRequest[]): void {
    if (!Array.isArray(messages)) {
      throw new ValidationError('Messages must be an array');
    }

    if (messages.length === 0) {
      throw new ValidationError('Message batch cannot be empty');
    }

    if (messages.length > 100) {
      throw new ValidationError('Message batch cannot exceed 100 messages');
    }

    // Validate each message
    messages.forEach((message, index) => {
      try {
        this.validateSendMessage(message);
      } catch (error) {
        throw new ValidationError(`Message at index ${index}: ${error.message}`);
      }
    });
  }

  public validateGroupParticipants(jid: string, participants: string[]): void {
    this.validateJID(jid);

    if (!Array.isArray(participants)) {
      throw new ValidationError('Participants must be an array');
    }

    if (participants.length === 0) {
      throw new ValidationError('Participants list cannot be empty');
    }

    if (participants.length > 50) {
      throw new ValidationError('Cannot add more than 50 participants at once');
    }

    participants.forEach((participant, index) => {
      try {
        this.validateJID(participant);
      } catch (error) {
        throw new ValidationError(`Participant at index ${index}: ${error.message}`);
      }
    });
  }

  // Validation schemas for complex objects
  private sendMessageSchema = Joi.object({
    jid: this.jidSchema,
    content: Joi.object().required(),
    options: Joi.object().optional()
  });

  private scheduleMessageSchema = Joi.object({
    jid: this.jidSchema,
    content: Joi.object().required(),
    options: Joi.object().optional(),
    scheduleTime: this.scheduleTimeSchema
  });

  // Helper method to get content type
  public getContentType(content: WAMessageContent): string {
    if ('text' in content) return 'text';
    if ('image' in content) return 'image';
    if ('video' in content) return 'video';
    if ('audio' in content) return 'audio';
    if ('document' in content) return 'document';
    if ('location' in content) return 'location';
    if ('contacts' in content) return 'contacts';
    if ('poll' in content) return 'poll';
    if ('react' in content) return 'reaction';
    if ('sticker' in content) return 'sticker';
    if ('orderMessage' in content) return 'order';
    if ('productMessage' in content) return 'product';
    if ('buttonsMessage' in content) return 'buttons';
    if ('templateMessage' in content) return 'template';
    if ('listMessage' in content) return 'list';
    if ('extendedTextMessage' in content) return 'extendedText';
    return 'unknown';
  }

  // Validate message content based on type
  public validateMessageContent(content: WAMessageContent): void {
    const contentType = this.getContentType(content);
    
    switch (contentType) {
      case 'text':
        this.validateTextMessage(content);
        break;
      case 'image':
        this.validateImageMessage(content);
        break;
      case 'video':
        this.validateVideoMessage(content);
        break;
      case 'audio':
        this.validateAudioMessage(content);
        break;
      case 'document':
        this.validateDocumentMessage(content);
        break;
      case 'location':
        this.validateLocationMessage(content);
        break;
      case 'contacts':
        this.validateContactMessage(content);
        break;
      case 'poll':
        this.validatePollMessage(content);
        break;
      case 'reaction':
        this.validateReactionMessage(content);
        break;
      default:
        // Allow unknown content types for extensibility
        break;
    }
  }
}

export default Validator;