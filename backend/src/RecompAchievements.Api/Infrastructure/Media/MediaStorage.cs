using System.Net.Http.Headers;
using System.Net.Http.Json;
using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Options;

namespace RecompAchievements.Api.Infrastructure.Media;

internal sealed class MediaOptions
{
    public string? BucketName { get; set; }
    public string? EvidenceBucketName { get; set; }
    public string? ServiceUrl { get; set; }
    public string? AccessKey { get; set; }
    public string? SecretKey { get; set; }
    public string? PublicBaseUrl { get; set; }
    public string? PurgeUrl { get; set; }
    public string? PurgeToken { get; set; }
}

public interface IMediaStore
{
    bool IsAvailable { get; }

    Uri? PublicUrl(string key);

    Task PutAsync(string key, byte[] content, string contentType, CancellationToken cancellationToken);

    Task DeleteAsync(IReadOnlyCollection<string> keys, CancellationToken cancellationToken);

    // Removes the URLs from the CDN. False means a cached copy may still be served.
    Task<bool> PurgeAsync(IReadOnlyCollection<string> keys, CancellationToken cancellationToken);

    // Copies a file to private evidence storage. False means no copy was kept.
    Task<bool> PreserveAsync(string key, string evidenceKey, CancellationToken cancellationToken);
}

internal static class MediaStorage
{
    public const string LocalRoute = "/local-media";
    private const string LocalFolder = ".local-media";

    /** Public files live in an S3-compatible bucket behind a CDN. Development without a bucket
     *  keeps them in an ignored local folder. Anywhere else without a bucket, uploads are off.
    **/
    public static IServiceCollection AddMediaStorage(this IServiceCollection services, IConfiguration configuration, IHostEnvironment environment)
    {
        var section = configuration.GetSection("MediaStorage");
        services.Configure<MediaOptions>(section);
        var options = section.Get<MediaOptions>() ?? new MediaOptions();

        if (string.IsNullOrWhiteSpace(options.BucketName))
        {
            if (environment.IsDevelopment())
            {
                services.AddSingleton<IMediaStore>(new LocalMediaStore(
                    Path.Combine(environment.ContentRootPath, LocalFolder),
                    configuration["MediaStorage:PublicBaseUrl"] ?? "http://localhost:5080" + LocalRoute));
            }
            else
            {
                services.AddSingleton<IMediaStore, UnavailableMediaStore>();
            }

            return services;
        }

        if (string.IsNullOrWhiteSpace(options.PublicBaseUrl) || string.IsNullOrWhiteSpace(options.ServiceUrl)
            || string.IsNullOrWhiteSpace(options.AccessKey) || string.IsNullOrWhiteSpace(options.SecretKey))
        {
            throw new InvalidOperationException("MediaStorage needs ServiceUrl, AccessKey, SecretKey, and PublicBaseUrl when BucketName is set.");
        }

        if (!environment.IsDevelopment() && (string.IsNullOrWhiteSpace(options.PurgeUrl) || string.IsNullOrWhiteSpace(options.PurgeToken)))
        {
            throw new InvalidOperationException("MediaStorage needs PurgeUrl and PurgeToken, so removed images leave the CDN.");
        }

        services.AddSingleton<IAmazonS3>(_ => new AmazonS3Client(
            new BasicAWSCredentials(options.AccessKey, options.SecretKey),
            new AmazonS3Config
            {
                ServiceURL = options.ServiceUrl,
                ForcePathStyle = true,
                RequestChecksumCalculation = RequestChecksumCalculation.WHEN_REQUIRED,
                ResponseChecksumValidation = ResponseChecksumValidation.WHEN_REQUIRED,
            }));
        services.AddHttpClient<IMediaStore, S3MediaStore>();
        return services;
    }

    public static WebApplication UseLocalMedia(this WebApplication app)
    {
        if (app.Services.GetRequiredService<IMediaStore>() is LocalMediaStore store)
        {
            Directory.CreateDirectory(store.Root);
            app.UseStaticFiles(new StaticFileOptions { FileProvider = new PhysicalFileProvider(store.Root), RequestPath = LocalRoute });
        }

        return app;
    }
}

internal sealed partial class S3MediaStore(
    IAmazonS3 s3,
    HttpClient http,
    IOptions<MediaOptions> options,
    ILogger<S3MediaStore> logger) : IMediaStore
{
    private const string ImmutableCache = "public, max-age=31536000, immutable";
    private const int PurgeBatchSize = 30;

    public bool IsAvailable => true;

    public Uri? PublicUrl(string key) => new($"{options.Value.PublicBaseUrl!.TrimEnd('/')}/{key}");

    public async Task PutAsync(string key, byte[] content, string contentType, CancellationToken cancellationToken)
    {
        using var stream = new MemoryStream(content, writable: false);
        var request = new PutObjectRequest
        {
            BucketName = options.Value.BucketName,
            Key = key,
            InputStream = stream,
            ContentType = contentType,
            DisablePayloadSigning = true,
        };
        request.Headers.CacheControl = ImmutableCache;
        await s3.PutObjectAsync(request, cancellationToken);
    }

    public async Task DeleteAsync(IReadOnlyCollection<string> keys, CancellationToken cancellationToken)
    {
        foreach (var key in keys)
        {
            await s3.DeleteObjectAsync(options.Value.BucketName, key, cancellationToken);
        }
    }

    public async Task<bool> PurgeAsync(IReadOnlyCollection<string> keys, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(options.Value.PurgeUrl) || string.IsNullOrWhiteSpace(options.Value.PurgeToken))
        {
            return false;
        }

        try
        {
            foreach (var batch in keys.Select(key => PublicUrl(key)!.ToString()).Chunk(PurgeBatchSize))
            {
                using var request = new HttpRequestMessage(HttpMethod.Post, options.Value.PurgeUrl)
                {
                    Content = JsonContent.Create(new MediaPurgeRequest(batch), AppJsonContext.Default.MediaPurgeRequest),
                };
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", options.Value.PurgeToken);
                using var response = await http.SendAsync(request, cancellationToken);
                response.EnsureSuccessStatusCode();
            }

            return true;
        }
        catch (HttpRequestException exception)
        {
            LogPurgeFailed(logger, exception);
            return false;
        }
    }

    public async Task<bool> PreserveAsync(string key, string evidenceKey, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(options.Value.EvidenceBucketName))
        {
            return false;
        }

        try
        {
            await s3.CopyObjectAsync(new CopyObjectRequest
            {
                SourceBucket = options.Value.BucketName,
                SourceKey = key,
                DestinationBucket = options.Value.EvidenceBucketName,
                DestinationKey = evidenceKey,
            }, cancellationToken);
            return true;
        }
        catch (AmazonS3Exception exception)
        {
            LogPreserveFailed(logger, exception);
            return false;
        }
    }

    [LoggerMessage(Level = LogLevel.Critical, Message = "Evidence could not be preserved before unpublishing")]
    private static partial void LogPreserveFailed(ILogger logger, Exception exception);

    [LoggerMessage(Level = LogLevel.Error, Message = "Removed media could not be purged from the CDN")]
    private static partial void LogPurgeFailed(ILogger logger, Exception exception);
}

public sealed record MediaPurgeRequest(string[] Files);

internal sealed class LocalMediaStore(string root, string publicBaseUrl) : IMediaStore
{
    public string Root { get; } = root;

    public bool IsAvailable => true;

    public Uri? PublicUrl(string key) => new($"{publicBaseUrl.TrimEnd('/')}/{key}");

    public async Task PutAsync(string key, byte[] content, string contentType, CancellationToken cancellationToken)
    {
        var path = Path.Combine(Root, key);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        await File.WriteAllBytesAsync(path, content, cancellationToken);
    }

    public Task DeleteAsync(IReadOnlyCollection<string> keys, CancellationToken cancellationToken)
    {
        foreach (var key in keys)
        {
            File.Delete(Path.Combine(Root, key));
        }

        return Task.CompletedTask;
    }

    public Task<bool> PurgeAsync(IReadOnlyCollection<string> keys, CancellationToken cancellationToken) => Task.FromResult(true);

    public Task<bool> PreserveAsync(string key, string evidenceKey, CancellationToken cancellationToken) => Task.FromResult(false);
}

internal sealed class UnavailableMediaStore : IMediaStore
{
    public bool IsAvailable => false;

    public Uri? PublicUrl(string key) => null;

    public Task PutAsync(string key, byte[] content, string contentType, CancellationToken cancellationToken) =>
        throw new InvalidOperationException("Media storage is not configured.");

    public Task DeleteAsync(IReadOnlyCollection<string> keys, CancellationToken cancellationToken) => Task.CompletedTask;

    public Task<bool> PurgeAsync(IReadOnlyCollection<string> keys, CancellationToken cancellationToken) => Task.FromResult(false);

    public Task<bool> PreserveAsync(string key, string evidenceKey, CancellationToken cancellationToken) => Task.FromResult(false);
}
