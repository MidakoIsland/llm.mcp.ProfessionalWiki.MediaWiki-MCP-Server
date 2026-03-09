import { z } from 'zod';
/* eslint-disable n/no-missing-import */
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, TextContent, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import type { ApiUploadParams } from 'types-mediawiki-api';
/* eslint-enable n/no-missing-import */
import type { ApiUploadResponse } from 'mwn';
import { getMwn } from '../common/mwn.js';
import { processBatchOperations, formatEditComment } from '../common/utils.js';

export function uploadFilesFromUrlTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'upload-files-from-url',
		'Uploads one or more files to the wiki from a web URL.',
		{
			files: z.array( z.object( {
				wikiSite: z.string().describe( 'The name of the wiki site to interact with (e.g. en.wikipedia.org)' ),
				url: z.string().url().describe( 'URL of the file to upload' ),
				title: z.string().describe( 'File title' ),
				text: z.string().describe( 'Wikitext on the file page' ),
				comment: z.string().optional().describe( 'Reason for uploading the file' )
			} ) ).describe( 'List of one or more files to upload from URLs' )
		},
		{
			title: 'Upload files from URL',
			readOnlyHint: false,
			destructiveHint: true
		} as ToolAnnotations,
		async ( { files } ) => handleUploadFilesFromUrlTool( files )
	);
}

async function handleUploadFilesFromUrlTool(
	files: { wikiSite: string; url: string; title: string; text: string; comment?: string }[]
): Promise< CallToolResult > {
	return processBatchOperations(
		files,
		( file ) => file.wikiSite,
		async ( file ) => {
			try {
				const mwn = await getMwn( file.wikiSite );
				const data = await mwn.uploadFromUrl( file.url, file.title, file.text, getApiUploadParams( file.comment ) );
				return [ {
					type: 'text' as const,
					text: `[${ file.wikiSite }] File uploaded successfully from URL: ${ file.title }\nUpload details: ${ JSON.stringify( data, null, 2 ) }`
				} ];
			} catch ( error ) {
				const errorMessage = ( error as Error ).message;
				if ( errorMessage.includes( 'copyuploaddisabled' ) ) {
					throw new Error( `Upload by URL is disabled for this wiki. Please download the image from the URL to the local disk first, then use the upload-files tool to upload it from the local file path.` );
				}
				throw error;
			}
		}
	);
}

function getApiUploadParams( comment?: string ): ApiUploadParams {
	return {
		comment: formatEditComment( 'upload-files-from-url', comment )
	};
}
