use utoipa::openapi::security::{HttpAuthScheme, HttpBuilder};
use utoipa::{Modify, OpenApi, openapi::security::SecurityScheme};

use crate::domains::auth;
use crate::domains::collections;
use crate::domains::groups;
use crate::domains::resources;
use crate::domains::users;

pub struct SecurityAddon;

impl Modify for SecurityAddon {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        if let Some(components) = openapi.components.as_mut() {
            components.add_security_scheme(
                "bearer_auth",
                SecurityScheme::Http(
                    HttpBuilder::new()
                        .scheme(HttpAuthScheme::Bearer)
                        .bearer_format("JWT")
                        .build(),
                ),
            );
        }
    }
}

#[derive(OpenApi)]
#[openapi(
    paths(
        // Auth
        auth::routes::register,
        auth::routes::login,
        auth::routes::refresh,
        auth::routes::logout,

        // Users
        users::routes::list_users,
        users::routes::get_me,
        users::routes::get_user,
        users::routes::create_user,
        users::routes::update_me,
        users::routes::update_user,
        users::routes::delete_me,
        users::routes::delete_user,

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
            users::models::User,
            users::models::CreateUser,
            users::models::UpdateUser,
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
        (name = "Users", description = "User management endpoints"),
        (name = "Collections", description = "Collection management endpoints"),
        (name = "Resources", description = "Resource management endpoints"),
        (name = "Groups", description = "Group management endpoints")
    ),
    modifiers(&SecurityAddon)
)]
pub struct ApiDoc;
