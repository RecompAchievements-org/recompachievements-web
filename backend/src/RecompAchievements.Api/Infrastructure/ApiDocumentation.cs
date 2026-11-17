using Scalar.AspNetCore;

namespace RecompAchievements.Api.Infrastructure;

internal static class ApiDocumentation
{
    // OpenAPI document at /openapi/v1.json and the Scalar reference UI at /scalar, Development only.
    public static WebApplication MapApiDocumentationInDevelopment(this WebApplication app)
    {
        if (app.Environment.IsDevelopment())
        {
            app.MapOpenApi();
            app.MapScalarApiReference();
        }

        return app;
    }
}
