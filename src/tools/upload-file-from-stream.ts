import { z } from 'zod';
/* eslint-disable n/no-missing-import */
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, TextContent, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import type { ApiUploadParams } from 'types-mediawiki-api';
/* eslint-enable n/no-missing-import */
import type { ApiUploadResponse } from 'mwn';
import { getMwn } from '../common/mwn.js';
import { formatEditComment, ensureWiki } from '../common/utils.js';

export function uploadFileFromStreamTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'upload-file-from-stream',
		'Uploads a file to the wiki using base64 encoded binary data or plain text string directly from the agent without requiring a local file.',
		{
			wikiSite: z.string().describe( 'The name of the wiki site to interact with (e.g. en.wikipedia.org)' ),
			content: z.string().describe( 'The actual content of the file. This can be raw text or a base64 encoded string for binary files.' ),
			isBase64: z.boolean().optional().default( false ).describe( 'Set to true if the content is a base64 encoded string representing a binary file.' ),
			title: z.string().describe( 'File title (e.g. File:MyImage.png)' ),
			text: z.string().describe( 'Wikitext on the file page' ),
			comment: z.string().optional().describe( 'Reason for uploading the file' )
		},
		{
			title: 'Upload file from stream',
			readOnlyHint: false,
			destructiveHint: true
		} as ToolAnnotations,
		async (
			{ wikiSite, content, isBase64, title, text, comment }
		) => handleUploadFileFromStreamTool( wikiSite, content, isBase64, title, text, comment )
	);
}

async function handleUploadFileFromStreamTool(
	wikiSite: string, content: string, isBase64: boolean, title: string, text: string, comment?: string
): Promise< CallToolResult > {
	ensureWiki( wikiSite );

	let data: ApiUploadResponse;
	try {
		const mwn = await getMwn();

		const buffer = isBase64 ? Buffer.from( content, 'base64' ) : Buffer.from( content, 'utf-8' );

		data = await mwn.request( {
			action: 'upload',
			file: {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				stream: buffer as any,
				name: title.replace( /^File:/i, '' ) // mwn's formdata handles the stream param natively
			},
			filename: title,
			text: text,
			ignorewarnings: true,
			token: await mwn.getCsrfToken(),
			...getApiUploadParams( comment )
		}, {
			headers: {
				'Content-Type': 'multipart/form-data'
			}
		} ) as { upload: ApiUploadResponse };

		// Flatten the response to match the mwn.upload() structure
		data = ( data as unknown as { upload: ApiUploadResponse } ).upload;

	} catch ( error ) {
		return {
			content: [
				{
					type: 'text',
					text: `Upload failed: ${ ( error as Error ).message }`
				} as TextContent
			],
			isError: true
		};
	}

	return {
		content: uploadFileFromStreamToolResult( data )
	};
}

function getApiUploadParams( comment?: string ): ApiUploadParams {
	return {
		comment: formatEditComment( 'upload-file-from-stream', comment )
	};
}

function uploadFileFromStreamToolResult( data: ApiUploadResponse ): TextContent[] {
	const result: TextContent[] = [
		{
			type: 'text',
			text: 'File uploaded successfully from stream'
		}
	];

	result.push( {
		type: 'text',
		text: `Upload details: ${ JSON.stringify( data, null, 2 ) }`
	} );

	return result;
}
