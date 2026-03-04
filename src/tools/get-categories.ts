import { z } from 'zod';
/* eslint-disable n/no-missing-import */
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, TextContent, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
/* eslint-enable n/no-missing-import */
import { getMwn } from '../common/mwn.js';
import { ensureWiki } from '../common/utils.js';

export function getCategoriesTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'get-categories',
		'Gets a list of all categories in the wiki along with their sizes (number of pages, files, and subcategories).',
		{
			wikiSite: z.string().describe( 'The name of the wiki site to interact with (e.g. en.wikipedia.org)' ),
			limit: z.number().int().min( 1 ).max( 500 ).optional().default( 50 ).describe( 'Maximum number of results to return' ),
			prefix: z.string().optional().describe( 'Filter categories starting with this prefix' )
		},
		{
			title: 'Get categories',
			readOnlyHint: true,
			destructiveHint: false
		} as ToolAnnotations,
		async ( { wikiSite, limit, prefix } ) => handleGetCategoriesTool( wikiSite, limit, prefix )
	);
}

async function handleGetCategoriesTool( wikiSite: string, limit: number, prefix?: string ): Promise< CallToolResult > {
	ensureWiki( wikiSite );

	try {
		const mwn = await getMwn();
		const params: Record<string, string | number> = {
			action: 'query',
			list: 'allcategories',
			aclimit: limit,
			acprop: 'size|hidden'
		};

		if ( prefix ) {
			params.acprefix = prefix;
		}

		const data = await mwn.request( params );

		if ( !data.query || !data.query.allcategories || data.query.allcategories.length === 0 ) {
			return {
				content: [
					{ type: 'text', text: 'No categories found.' } as TextContent
				]
			};
		}

		return {
			content: data.query.allcategories.map( getCategoryToolResult )
		};
	} catch ( error ) {
		return {
			content: [
				{ type: 'text', text: `Failed to retrieve categories: ${ ( error as Error ).message }` } as TextContent
			],
			isError: true
		};
	}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getCategoryToolResult( result: any ): TextContent {
	return {
		type: 'text',
		text: [
			`Category: ${ result.category }`,
			`Size: ${ result.size } (Pages: ${ result.pages }, Files: ${ result.files }, Subcats: ${ result.subcats })`,
			`Hidden: ${ result.hidden !== undefined ? 'true' : 'false' }`
		].join( '\n' )
	};
}
