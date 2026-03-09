import { z } from 'zod';
/* eslint-disable n/no-missing-import */
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, TextContent, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import type { ApiUploadParams } from 'types-mediawiki-api';
/* eslint-enable n/no-missing-import */
import type { ApiUploadResponse } from 'mwn';
import { getMwn } from '../common/mwn.js';
import { formatEditComment, ensureWiki } from '../common/utils.js';

export function uploadFilesFromStreamTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'upload-files-from-stream',
		'Uploads one or more files to the wiki using base64 encoded binary data or plain text strings directly from the agent without requiring a local file.',
		{
			files: z.array( z.object( {
				wikiSite: z.string().describe( 'The name of the wiki site to interact with (e.g. en.wikipedia.org)' ),
				content: z.string().describe( 'The actual content of the file. This can be raw text or a base64 encoded string for binary files.' ),
				isBase64: z.boolean().optional().default( false ).describe( 'Set to true if the content is a base64 encoded string representing a binary file.' ),
				title: z.string().describe( 'File title (e.g. File:MyImage.png)' ),
				text: z.string().describe( 'Wikitext on the file page' ),
				comment: z.string().optional().describe( 'Reason for uploading the file' )
			} ) ).describe( 'List of one or more files to upload from streams' )
		},
		{
			title: 'Upload files from stream',
			readOnlyHint: false,
			destructiveHint: true
		} as ToolAnnotations,
		async ( { files } ) => handleUploadFilesFromStreamTool( files )
	);
}

async function handleUploadFilesFromStreamTool(
	files: { wikiSite: string; content: string; isBase64: boolean; title: string; text: string; comment?: string }[]
): Promise< CallToolResult > {
	const results: TextContent[] = [];
	let hasError = false;

	for ( const file of files ) {
		try {
			ensureWiki( file.wikiSite );
			const mwn = await getMwn();

			const buffer = file.isBase64 ? Buffer.from( file.content, 'base64' ) : Buffer.from( file.content, 'utf-8' );

			const rawData = await mwn.request( {
				action: 'upload',
				file: {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					stream: buffer as any,
					name: file.title.replace( /^File:/i, '' ) // mwn's formdata handles the stream param natively
				},
				filename: file.title,
				text: file.text,
				ignorewarnings: true,
				token: await mwn.getCsrfToken(),
				...getApiUploadParams( file.comment )
			}, {
				headers: {
					'Content-Type': 'multipart/form-data'
				}
			} ) as unknown as { upload: ApiUploadResponse };

			// Flatten the response to match the mwn.upload() structure
			const data = rawData.upload;

			results.push( {
				type: 'text',
				text: `[${ file.wikiSite }] File uploaded successfully from stream: ${ file.title }\nUpload details: ${ JSON.stringify( data, null, 2 ) }`
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
		comment: formatEditComment( 'upload-files-from-stream', comment )
	};
}
