#!/bin/bash

# Network Monitoring Backend Deployment Script
# This script automates the deployment process for the monitoring backend

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="network-monitoring-backend"
IMAGE_NAME="monitoring-backend"
CONTAINER_NAME="monitoring-backend-prod"

# Functions
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed and running
check_docker() {
    print_status "Checking Docker installation..."
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi

    if ! docker info &> /dev/null; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
    print_success "Docker is ready"
}

# Check if Docker Compose is available
check_docker_compose() {
    print_status "Checking Docker Compose..."
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not available. Please install Docker Compose."
        exit 1
    fi
    print_success "Docker Compose is ready"
}

# Run tests before deployment
run_tests() {
    print_status "Running test suite..."
    if [ -f "run_tests.py" ]; then
        python run_tests.py
        print_success "All tests passed"
    else
        print_warning "Test runner not found, skipping tests"
    fi
}

# Build Docker image
build_image() {
    print_status "Building Docker image..."
    docker build -t $IMAGE_NAME:latest .
    print_success "Docker image built successfully"
}

# Deploy with Docker Compose
deploy_with_compose() {
    local env_file=${1:-".env"}
    
    print_status "Deploying with Docker Compose..."
    
    if [ ! -f "$env_file" ]; then
        print_warning "Environment file $env_file not found. Creating from template..."
        if [ -f "env.example" ]; then
            cp env.example $env_file
            print_warning "Please edit $env_file with your configuration before running again."
            exit 1
        else
            print_error "No environment template found. Please create $env_file manually."
            exit 1
        fi
    fi

    # Use production compose file if available
    if [ -f "docker-compose.prod.yml" ]; then
        docker-compose -f docker-compose.prod.yml --env-file $env_file up -d
    else
        docker-compose --env-file $env_file up -d
    fi
    
    print_success "Application deployed successfully"
}

# Deploy standalone container
deploy_standalone() {
    print_status "Deploying standalone container..."
    
    # Stop and remove existing container
    if docker ps -a | grep -q $CONTAINER_NAME; then
        print_status "Stopping existing container..."
        docker stop $CONTAINER_NAME
        docker rm $CONTAINER_NAME
    fi

    # Run new container
    docker run -d \
        --name $CONTAINER_NAME \
        --restart unless-stopped \
        -p 8000:8000 \
        --env-file .env \
        $IMAGE_NAME:latest

    print_success "Standalone container deployed successfully"
}

# Health check
health_check() {
    print_status "Performing health check..."
    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost:8000/health &> /dev/null; then
            print_success "Application is healthy and responding"
            return 0
        fi
        
        print_status "Health check attempt $attempt/$max_attempts..."
        sleep 2
        ((attempt++))
    done

    print_error "Health check failed after $max_attempts attempts"
    return 1
}

# Show logs
show_logs() {
    print_status "Showing application logs..."
    if docker-compose ps | grep -q "Up"; then
        docker-compose logs -f app
    elif docker ps | grep -q $CONTAINER_NAME; then
        docker logs -f $CONTAINER_NAME
    else
        print_error "No running containers found"
    fi
}

# Stop deployment
stop_deployment() {
    print_status "Stopping deployment..."
    if [ -f "docker-compose.yml" ]; then
        docker-compose down
    fi
    
    if docker ps | grep -q $CONTAINER_NAME; then
        docker stop $CONTAINER_NAME
        docker rm $CONTAINER_NAME
    fi
    
    print_success "Deployment stopped"
}

# Backup database
backup_database() {
    print_status "Creating database backup..."
    local backup_dir="./backups"
    local backup_file="$backup_dir/backup_$(date +%Y%m%d_%H%M%S).sql"
    
    mkdir -p $backup_dir
    
    if docker-compose ps | grep -q db; then
        docker-compose exec -T db pg_dump -U monitoring_user monitoring_db > $backup_file
        print_success "Database backup created: $backup_file"
    else
        print_error "Database container not found"
        return 1
    fi
}

# Update deployment
update_deployment() {
    print_status "Updating deployment..."
    
    # Backup database first
    backup_database
    
    # Pull latest code (if in git repo)
    if [ -d ".git" ]; then
        git pull
    fi
    
    # Rebuild and redeploy
    build_image
    
    if [ -f "docker-compose.yml" ]; then
        docker-compose up -d --force-recreate
    else
        deploy_standalone
    fi
    
    health_check
    print_success "Deployment updated successfully"
}

# Main script
main() {
    echo "🚀 Network Monitoring Backend Deployment Script"
    echo "================================================"
    
    case ${1:-help} in
        "build")
            check_docker
            run_tests
            build_image
            ;;
        "deploy")
            check_docker
            check_docker_compose
            run_tests
            build_image
            deploy_with_compose ${2:-.env}
            health_check
            ;;
        "deploy-standalone")
            check_docker
            run_tests
            build_image
            deploy_standalone
            health_check
            ;;
        "stop")
            stop_deployment
            ;;
        "logs")
            show_logs
            ;;
        "health")
            health_check
            ;;
        "backup")
            backup_database
            ;;
        "update")
            check_docker
            check_docker_compose
            update_deployment
            ;;
        "help"|*)
            echo "Usage: $0 {build|deploy|deploy-standalone|stop|logs|health|backup|update}"
            echo ""
            echo "Commands:"
            echo "  build              - Build Docker image"
            echo "  deploy [env-file]  - Deploy with Docker Compose (default: .env)"
            echo "  deploy-standalone  - Deploy standalone container"
            echo "  stop              - Stop all containers"
            echo "  logs              - Show application logs"
            echo "  health            - Check application health"
            echo "  backup            - Backup database"
            echo "  update            - Update deployment with latest code"
            echo "  help              - Show this help message"
            ;;
    esac
}

# Run main function with all arguments
main "$@"