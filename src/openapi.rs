use utoipa::OpenApi;

use crate::domains::auth;
use crate::domains::collections;
use crate::domains::groups;
use crate::domains::resources;

#[derive(OpenApi)]
#[openapi(
    paths(
        // Auth
        auth::routes::register,
        auth::routes::login,
        auth::routes::refresh,
        auth::routes::logout,

        // Collections
        collections::routes::list_collections,
        collections::routes::get_collection,
        collections::routes::create_collection,
        collections::routes::update_collection,
        collections::routes::delete_collection,

        // Resources
        resources::routes::list_resources,
        resources::routes::get_resource,
        resources::routes::create_resource,
        resources::routes::update_resource,
        resources::routes::delete_resource,

        // Groups
        groups::routes::list_groups,
        groups::routes::get_group,
        groups::routes::create_group,
        groups::routes::update_group,
        groups::routes::delete_group,
    ),
    components(
        schemas(
            auth::models::AuthTokens,
            auth::models::RegisterPayload,
            auth::models::LoginPayload,
            auth::models::RefreshPayload,
            collections::models::Collection,
            collections::models::CreateCollection,
            collections::models::UpdateCollection,
            resources::models::Resource,
            resources::models::CreateResource,
            resources::models::UpdateResource,
            groups::models::Group,
            groups::models::CreateGroup,
            groups::models::UpdateGroup,

        )
    ),
    tags(
        (name = "Auth", description = "Authentication & session management endpoints"),
        (name = "Collections", description = "Collection management endpoints"),
        (name = "Resources", description = "Resource management endpoints"),
        (name = "Groups", description = "Group management endpoints")
    )
)]
pub struct ApiDoc;
