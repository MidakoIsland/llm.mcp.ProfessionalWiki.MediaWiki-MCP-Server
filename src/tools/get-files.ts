import { z } from 'zod';
/* eslint-disable n/no-missing-import */
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, TextContent, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
/* eslint-enable n/no-missing-import */
import { makeRestGetRequest, ensureWiki } from '../common/utils.js';
import type { MwRestApiFileObject } from '../types/mwRestApi.js';

export function getFilesTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'get-files',
		'Returns information about one or more files, including links to download the files in thumbnail, preview, and original formats.',
		{
			files: z.array( z.object( {
				wikiSite: z.string().describe( 'The name of the wiki site to interact with (e.g. en.wikipedia.org)' ),
				title: z.string().describe( 'File title' )
			} ) ).describe( 'List of one or more files to get' )
		},
		{
			title: 'Get files',
			readOnlyHint: true,
			destructiveHint: false
		} as ToolAnnotations,
		async ( { files } ) => handleGetFilesTool( files )
	);
}

async function handleGetFilesTool(
	files: { wikiSite: string; title: string }[]
): Promise< CallToolResult > {
	const results: TextContent[] = [];
	let hasError = false;

	for ( const file of files ) {
		try {
			ensureWiki( file.wikiSite );
			const data = await makeRestGetRequest<MwRestApiFileObject>( `/v1/file/${ encodeURIComponent( file.title ) }` );
			
			results.push( {
				type: 'text',
				text: `[${ file.wikiSite }] File: ${ file.title }\n` + getFileToolResult( data ).map( t => t.text ).join( '\n' )
			} );
		} catch ( error ) {
			hasError = true;
			results.push( {
				type: 'text',
				text: `[${ file.wikiSite }] Failed to retrieve file data for "${ file.title }": ${ ( error as Error ).message }`
			} );
		}
	}

	return {
		content: results,
		isError: hasError
	};
}

function getFileToolResult( result: MwRestApiFileObject ): TextContent[] {
	return [
		{
			type: 'text',
			text: [
				`File title: ${ result.title }`,
				`File description URL: ${ result.file_description_url }`,
				`Latest revision timestamp: ${ result.latest.timestamp }`,
				`Latest revision user: ${ result.latest.user.name }`,
				`Preferred URL: ${ result.preferred.url }`,
				`Original URL: ${ result.original.url }`,
				`Thumbnail URL: ${ result.thumbnail?.url }`
			].join( '\n' )
		}
	];
}
