import { z } from 'zod';
/* eslint-disable n/no-missing-import */
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, TextContent, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import type { ApiUploadParams } from 'types-mediawiki-api';
/* eslint-enable n/no-missing-import */
import type { ApiUploadResponse } from 'mwn';
import { getMwn } from '../common/mwn.js';
import { formatEditComment, ensureWiki } from '../common/utils.js';

export function uploadFilesTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'upload-files',
		'Uploads one or more files to the wiki from the local disk.',
		{
			files: z.array( z.object( {
				wikiSite: z.string().describe( 'The name of the wiki site to interact with (e.g. en.wikipedia.org)' ),
				filepath: z.string().describe( 'File path on the local disk' ),
				title: z.string().describe( 'File title' ),
				text: z.string().describe( 'Wikitext on the file page' ),
				comment: z.string().optional().describe( 'Reason for uploading the file' )
			} ) ).describe( 'List of one or more files to upload' )
		},
		{
			title: 'Upload files',
			readOnlyHint: false,
			destructiveHint: true
		} as ToolAnnotations,
		async ( { files } ) => handleUploadFilesTool( files )
	);
}

async function handleUploadFilesTool(
	files: { wikiSite: string; filepath: string; title: string; text: string; comment?: string }[]
): Promise< CallToolResult > {
	const results: TextContent[] = [];
	let hasError = false;

	for ( const file of files ) {
		try {
			ensureWiki( file.wikiSite );
			const mwn = await getMwn();
			const data = await mwn.upload( file.filepath, file.title, file.text, getApiUploadParams( file.comment ) );
			
			results.push( {
				type: 'text',
				text: `[${ file.wikiSite }] File uploaded successfully: ${ file.title }\nUpload details: ${ JSON.stringify( data, null, 2 ) }`
			} );
		} catch ( error ) {
			hasError = true;
			results.push( {
				type: 'text',
				text: `[${ file.wikiSite }] Failed to upload file "${ file.title }": ${ ( error as Error ).message }`
			} );
		}
	}

	return {
		content: results,
		isError: hasError
	};
}

function getApiUploadParams( comment?: string ): ApiUploadParams {
	return {
		comment: formatEditComment( 'upload-files', comment )
	};
}
