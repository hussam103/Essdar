/**
 * Etimad Tender Service - provides functionality for fetching tender data from Etimad.sa
 * 
 * This service provides methods to:
 * 1. Scrape tenders from Etimad and save them to the database
 * 2. Get detailed information for specific tenders
 * 3. Retrieve tenders with pagination and filtering
 */

import axios from 'axios';
import { db } from '../db';
import { tenders, insertTenderSchema } from '@shared/schema';
import { storage } from '../storage';
import { log } from '../vite';
import { eq, sql } from 'drizzle-orm';

// Base URL for the Etimad Tender Scraper API
const ETIMAD_API_BASE_URL = process.env.ETIMAD_API_URL || 'http://localhost:3000';

interface EtimadTender {
  id?: number;
  entityName: string;
  tenderTitle: string;
  tenderIdString: string;
  tenderType: string;
  tenderValue?: number;
  lastEnrollDate?: string;
  lastOfferDate?: string;
  submissionDetails?: string;
  details?: any;
}

/**
 * Scrapes tenders from Etimad platform and saves to the database
 * @param page Page number (default: 1)
 * @param pageSize Number of tenders per page (default: 10, max: 100)
 * @returns An array of tender data objects
 */
export async function scrapeTenders(page: number = 1, pageSize: number = 10): Promise<any[]> {
  try {
    log(`Fetching tenders from Etimad API - page ${page}, pageSize ${pageSize}`, 'etimad-service');
    
    const response = await axios.get(`${ETIMAD_API_BASE_URL}/api/scrape-tenders`, {
      params: {
        page,
        page_size: pageSize,
      }
    });
    
    if (response.data && Array.isArray(response.data)) {
      log(`Successfully fetched ${response.data.length} tenders from Etimad`, 'etimad-service');
      
      // Save tenders to the database
      await saveTendersToDatabase(response.data);
      
      return response.data;
    } else {
      log(`Invalid response from Etimad API: ${JSON.stringify(response.data)}`, 'etimad-service');
      return [];
    }
  } catch (error: any) {
    const errorMessage = error?.message || 'Unknown error';
    log(`Error scraping tenders from Etimad: ${errorMessage}`, 'etimad-service');
    throw new Error(`Failed to scrape tenders from Etimad: ${errorMessage}`);
  }
}

/**
 * Gets detailed information for a specific tender
 * @param tenderIdString Encrypted tender ID string
 * @returns Detailed tender information
 */
export async function getTenderDetails(tenderIdString: string): Promise<any> {
  try {
    log(`Fetching tender details for ID ${tenderIdString}`, 'etimad-service');
    
    const response = await axios.get(`${ETIMAD_API_BASE_URL}/api/tender-details/${tenderIdString}`);
    
    if (response.data) {
      log(`Successfully fetched details for tender ${tenderIdString}`, 'etimad-service');
      
      // Update the tender in the database with the new details
      await updateTenderDetails(tenderIdString, response.data);
      
      return response.data;
    } else {
      log(`Invalid response for tender details: ${JSON.stringify(response.data)}`, 'etimad-service');
      return null;
    }
  } catch (error: any) {
    const errorMessage = error?.message || 'Unknown error';
    log(`Error fetching tender details: ${errorMessage}`, 'etimad-service');
    throw new Error(`Failed to get tender details: ${errorMessage}`);
  }
}

/**
 * Gets a paginated list of tenders with optional filtering
 * @param page Page number (default: 1)
 * @param pageSize Number of items per page (default: 10, max: 100)
 * @param tenderType Optional filter by tender type
 * @param agencyName Optional filter by agency name
 * @returns Paginated list of tenders
 */
export async function getPaginatedTenders(
  page: number = 1, 
  pageSize: number = 10,
  tenderType?: string,
  agencyName?: string
): Promise<any> {
  try {
    log(`Fetching paginated tenders - page ${page}, pageSize ${pageSize}`, 'etimad-service');
    
    const params: any = {
      page,
      page_size: pageSize,
    };
    
    if (tenderType) params.tender_type = tenderType;
    if (agencyName) params.agency_name = agencyName;
    
    const response = await axios.get(`${ETIMAD_API_BASE_URL}/api/tenders`, { params });
    
    if (response.data) {
      log(`Successfully fetched paginated tenders`, 'etimad-service');
      return response.data;
    } else {
      log(`Invalid response for paginated tenders: ${JSON.stringify(response.data)}`, 'etimad-service');
      return { tenders: [], totalCount: 0 };
    }
  } catch (error: any) {
    const errorMessage = error?.message || 'Unknown error';
    log(`Error fetching paginated tenders: ${errorMessage}`, 'etimad-service');
    throw new Error(`Failed to get paginated tenders: ${errorMessage}`);
  }
}

/**
 * Gets a specific tender by ID
 * @param tenderId Tender ID
 * @returns Tender data
 */
export async function getTenderById(tenderId: number): Promise<any> {
  try {
    log(`Fetching tender by ID ${tenderId}`, 'etimad-service');
    
    const response = await axios.get(`${ETIMAD_API_BASE_URL}/api/tenders/${tenderId}`);
    
    if (response.data) {
      log(`Successfully fetched tender ${tenderId}`, 'etimad-service');
      return response.data;
    } else {
      log(`Invalid response for tender ${tenderId}: ${JSON.stringify(response.data)}`, 'etimad-service');
      return null;
    }
  } catch (error: any) {
    const errorMessage = error?.message || 'Unknown error';
    log(`Error fetching tender by ID: ${errorMessage}`, 'etimad-service');
    throw new Error(`Failed to get tender by ID: ${errorMessage}`);
  }
}

/**
 * Saves tenders to the database
 * @param tendersData Array of tender data from Etimad
 */
async function saveTendersToDatabase(tendersData: EtimadTender[]): Promise<void> {
  try {
    log(`Saving ${tendersData.length} tenders to database`, 'etimad-service');
    
    for (const tenderData of tendersData) {
      // Check if the tender already exists in the database by tenderIdString
      const existingTender = await db.select()
        .from(tenders)
        .where(eq(tenders.externalId, tenderData.tenderIdString))
        .limit(1);
      
      if (existingTender.length === 0) {
        // Map the Etimad tender data to our database schema
        const insertData = {
          title: tenderData.tenderTitle,
          agency: tenderData.entityName,
          bidNumber: tenderData.tenderIdString,
          description: tenderData.details?.description || '',
          category: tenderData.tenderType || 'General',
          status: 'Active',
          releaseDate: new Date(),
          closingDate: tenderData.lastOfferDate ? new Date(tenderData.lastOfferDate) : null,
          enrollmentDeadline: tenderData.lastEnrollDate ? new Date(tenderData.lastEnrollDate) : null,
          value: tenderData.tenderValue || null,
          industry: tenderData.details?.industry || 'General',
          requirements: tenderData.details?.requirements || '',
          keywords: tenderData.details?.keywords || [],
          location: tenderData.details?.location || '',
          externalId: tenderData.tenderIdString,
          externalSource: 'Etimad',
          externalUrl: `https://tenders.etimad.sa/Tender/Details/${tenderData.tenderIdString}`,
          rawData: JSON.stringify(tenderData),
        };
        
        // Validate the data with Zod schema
        const validatedData = insertTenderSchema.parse(insertData);
        
        // Insert the tender into the database
        await storage.createTender(validatedData);
        log(`Created new tender: ${tenderData.tenderTitle}`, 'etimad-service');
      } else {
        log(`Tender ${tenderData.tenderIdString} already exists in database`, 'etimad-service');
      }
    }
    
    log(`Completed saving tenders to database`, 'etimad-service');
  } catch (error: any) {
    const errorMessage = error?.message || 'Unknown error';
    log(`Error saving tenders to database: ${errorMessage}`, 'etimad-service');
    throw new Error(`Failed to save tenders to database: ${errorMessage}`);
  }
}

/**
 * Updates a tender in the database with new details
 * @param tenderIdString Tender ID string
 * @param details Detail data from Etimad
 */
async function updateTenderDetails(tenderIdString: string, details: any): Promise<void> {
  try {
    log(`Updating tender details for ${tenderIdString}`, 'etimad-service');
    
    // Find the tender by externalId
    const existingTenders = await db.select()
      .from(tenders)
      .where(eq(tenders.externalId, tenderIdString))
      .limit(1);
    
    if (existingTenders.length === 0) {
      log(`Tender ${tenderIdString} not found in database`, 'etimad-service');
      return;
    }
    
    const existingTender = existingTenders[0];
    
    // Update with new details
    const updateData = {
      description: details.description || existingTender.description,
      requirements: details.requirements || existingTender.requirements,
      keywords: details.keywords || existingTender.keywords,
      industry: details.industry || existingTender.industry,
      location: details.location || existingTender.location,
      rawData: JSON.stringify({ ...JSON.parse(existingTender.rawData || '{}'), details }),
    };
    
    // Update in the database
    await db.update(tenders)
      .set(updateData)
      .where(eq(tenders.id, existingTender.id));
    
    log(`Successfully updated tender details for ${tenderIdString}`, 'etimad-service');
  } catch (error: any) {
    const errorMessage = error?.message || 'Unknown error';
    log(`Error updating tender details: ${errorMessage}`, 'etimad-service');
    throw new Error(`Failed to update tender details: ${errorMessage}`);
  }
}