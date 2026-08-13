use utoipa::OpenApi;

use crate::domains::{
    collections::{models as col_models, routes as col_routes},
    resources::{models as res_models, routes as res_routes},
};

#[derive(OpenApi)]
#[openapi(
    paths(
        col_routes::list_collections,
        col_routes::create_collection,
        col_routes::get_collection,
        col_routes::update_collection,
        col_routes::delete_collection,
        res_routes::list_resources,
        res_routes::create_resource,
        res_routes::get_resource,
        res_routes::update_resource,
        res_routes::delete_resource,
    ),
    components(
        schemas(
            col_models::Collection,
            col_models::CreateCollection,
            col_models::UpdateCollection,
            res_models::Resource,
            res_models::CreateResource,
            res_models::UpdateResource,
        )
    ),
    tags(
        (name = "Collections", description = "Collection management endpoints"),
        (name = "Resources", description = "Resource management endpoints")
    )
)]
pub struct ApiDoc;
