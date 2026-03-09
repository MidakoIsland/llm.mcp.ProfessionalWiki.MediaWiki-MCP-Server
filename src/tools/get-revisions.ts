import { z } from 'zod';
/* eslint-disable n/no-missing-import */
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, TextContent, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
/* eslint-enable n/no-missing-import */
import { makeRestGetRequest, ensureWiki } from '../common/utils.js';
import type { MwRestApiRevisionObject } from '../types/mwRestApi.js';
import { ContentFormat, getSubEndpoint } from '../common/mwRestApiContentFormat.js';

export function getRevisionsTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'get-revisions',
		'Returns one or more revisions of a wiki page or pages.',
		{
			revisions: z.array( z.object( {
				wikiSite: z.string().describe( 'The name of the wiki site to interact with (e.g. en.wikipedia.org)' ),
				revisionId: z.number().int().positive().describe( 'Revision ID' ),
				content: z.nativeEnum( ContentFormat ).describe( 'Type of content to return' ).optional().default( ContentFormat.source ),
				metadata: z.boolean().describe( 'Whether to include metadata (revision ID, page ID, page title, user ID, user name, timestamp, comment, size, delta, minor, HTML URL) in the response' ).optional().default( false )
			} ) ).describe( 'List of one or more revisions to retrieve' )
		},
		{
			title: 'Get revisions',
			readOnlyHint: true,
			destructiveHint: false
		} as ToolAnnotations,
		async ( { revisions } ) => handleGetRevisionsTool( revisions )
	);
}

async function handleGetRevisionsTool(
	revisions: { wikiSite: string; revisionId: number; content: ContentFormat; metadata: boolean }[]
): Promise<CallToolResult> {
	const results: TextContent[] = [];
	let hasError = false;

	for ( const rev of revisions ) {
		if ( rev.content === ContentFormat.none && !rev.metadata ) {
			hasError = true;
			results.push( {
				type: 'text',
				text: `[${ rev.wikiSite }] Error for revision ${ rev.revisionId }: When content is set to "none", metadata must be true`
			} );
			continue;
		}

		try {
			ensureWiki( rev.wikiSite );
			const data = await makeRestGetRequest<MwRestApiRevisionObject>(
				`/v1/revision/${ rev.revisionId }${ getSubEndpoint( rev.content ) }`
			);
			
			const revResults = getRevisionToolResult( data, rev.content, rev.metadata );
			for ( const res of revResults ) {
				results.push( {
					type: 'text',
					text: `[${ rev.wikiSite }] Revision ${ rev.revisionId }:\n${ res.text }`
				} );
			}
		} catch ( error ) {
			hasError = true;
			results.push( {
				type: 'text',
				text: `[${ rev.wikiSite }] Failed to retrieve revision data for ${ rev.revisionId }: ${ ( error as Error ).message }`
			} );
		}
	}

	return {
		content: results,
		isError: hasError
	};
}

function getRevisionToolResult(
	result: MwRestApiRevisionObject,
	content: ContentFormat,
	metadata: boolean
): TextContent[] {
	if ( content === ContentFormat.source && !metadata ) {
		return [ {
			type: 'text',
			text: result.source ?? 'Not available'
		} ];
	}

	if ( content === ContentFormat.html && !metadata ) {
		return [ {
			type: 'text',
			text: result.html ?? 'Not available'
		} ];
	}

	const results: TextContent[] = [ getRevisionMetadataTextContent( result ) ];

	if ( result.source !== undefined ) {
		results.push( {
			type: 'text',
			text: `Source:\n${ result.source }`
		} );
	}

	if ( result.html !== undefined ) {
		results.push( {
			type: 'text',
			text: `HTML:\n${ result.html }`
		} );
	}

	return results;
}

function getRevisionMetadataTextContent( result: MwRestApiRevisionObject ): TextContent {
	return {
		type: 'text',
		text: [
			`Revision ID: ${ result.id }`,
			`Page ID: ${ result.page?.id }`,
			`Page Title: ${ result.page?.title }`,
			`User ID: ${ result.user.id }`,
			`User Name: ${ result.user.name }`,
			`Timestamp: ${ result.timestamp }`,
			`Comment: ${ result.comment }`,
			`Size: ${ result.size }`,
			`Delta: ${ result.delta }`,
			`Minor: ${ result.minor }`,
			`HTML URL: ${ result.html_url ?? 'Not available' }`
		].join( '\n' )
	};
}
